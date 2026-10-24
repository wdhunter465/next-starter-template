import { describe, expect, it } from "vitest";

import {
  InternetArchiveHttpError,
  buildInternetArchiveSearchUrl,
  fetchInternetArchiveDocs,
  mapInternetArchiveDocToCandidateFields,
  pre1931DateLead,
} from "../functions/_lib/content-pipeline-internet-archive-adapter";

const query = "Lou Gehrig";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe("pre1931DateLead (#4789)", () => {
  it("keeps a year or calendar date inside 1900-1930", () => {
    expect(pre1931DateLead("1927")).toBe("1927");
    expect(pre1931DateLead("1930-12-31")).toBe("1930-12-31");
    expect(pre1931DateLead("1928-01-17T00:00:00Z")).toBe("1928-01-17T00:00:00Z");
  });

  it("drops undated, prose, and out-of-range values", () => {
    expect(pre1931DateLead("")).toBeNull();
    expect(pre1931DateLead("circa 1927")).toBeNull();
    expect(pre1931DateLead("1899")).toBeNull();
    expect(pre1931DateLead("1931-01-01")).toBeNull();
  });
});

describe("buildInternetArchiveSearchUrl (#4789)", () => {
  it("asks for the pre-1931 media types and the rights fields", () => {
    const url = new URL(buildInternetArchiveSearchUrl("Lou Gehrig", 20));
    expect(url.origin + url.pathname).toBe("https://archive.org/advancedsearch.php");
    expect(url.searchParams.get("q")).toContain("date:[1900-01-01 TO 1930-12-31]");
    expect(url.searchParams.get("q")).toContain("mediatype:(texts OR image OR movies)");
    expect(url.searchParams.get("rows")).toBe("20");
    expect(url.searchParams.getAll("fl[]")).toEqual([
      "identifier",
      "title",
      "date",
      "publisher",
      "rights",
      "licenseurl",
      "mediatype",
      "collection",
    ]);
  });

  it("caps a request at 100 rows", () => {
    const url = new URL(buildInternetArchiveSearchUrl("Lou Gehrig", 500));
    expect(url.searchParams.get("rows")).toBe("100");
  });
});

describe("mapInternetArchiveDocToCandidateFields (#4789)", () => {
  it("maps a dated text and keeps rights as evidence with no conclusion", () => {
    const fields = mapInternetArchiveDocToCandidateFields(
      {
        identifier: "following-the-babe-1927",
        title: "Following the Babe",
        date: "1927",
        publisher: "New York World",
        rights: "The copyright is in the public domain.",
        licenseurl: "https://creativecommons.org/publicdomain/mark/1.0/",
        mediatype: "texts",
        collection: ["americana", "newspapers"],
        publicdate: "2014-05-01T00:00:00Z",
      },
      query,
    );

    expect(fields).not.toBeNull();
    expect(fields?.contentType).toBe("article");
    expect(fields?.dateOrPeriod).toBe("1927");
    expect(fields?.sourceDomain).toBe("archive.org");
    expect(fields?.sourceUrl).toBe("https://archive.org/details/following-the-babe-1927");
    expect(fields?.sourceOwner).toBe("New York World");
    expect(fields?.rightsStatus).toBe("unknown");
    expect(fields?.rightsEvidence.evidence_type).toBe("other");
    expect(fields?.rightsEvidence.evidence_text).toContain("The copyright is in the public domain.");
    expect(fields?.rightsEvidence.evidence_url).toBe("https://creativecommons.org/publicdomain/mark/1.0/");
    expect(fields?.rightsEvidence).not.toHaveProperty("conclusion");
    expect(fields?.provenanceNotes).toContain("not recorded as a first-publication date");
    expect(fields?.provenanceNotes).toContain("americana, newspapers");
    expect(fields?.provenanceNotes).not.toContain("2014-05-01");
  });

  it("maps an image to photo and a movie to video", () => {
    expect(
      mapInternetArchiveDocToCandidateFields(
        { identifier: "gehrig-photo", date: "1925-06-01", mediatype: "image", title: "Gehrig" },
        query,
      )?.contentType,
    ).toBe("photo");
    expect(
      mapInternetArchiveDocToCandidateFields(
        { identifier: "gehrig-reel", date: "1928", mediatype: "movies", title: "Newsreel" },
        query,
      )?.contentType,
    ).toBe("video");
  });

  it("drops undated items, upload-only dates, and other media types", () => {
    expect(
      mapInternetArchiveDocToCandidateFields(
        { identifier: "no-date", mediatype: "texts", title: "Untitled", publicdate: "2010-01-01" },
        query,
      ),
    ).toBeNull();
    expect(
      mapInternetArchiveDocToCandidateFields(
        { identifier: "audio-item", date: "1927", mediatype: "audio", title: "Radio" },
        query,
      ),
    ).toBeNull();
    expect(
      mapInternetArchiveDocToCandidateFields(
        { identifier: "later", date: "1960", mediatype: "texts", title: "Reprint" },
        query,
      ),
    ).toBeNull();
  });
});

describe("fetchInternetArchiveDocs (#4789)", () => {
  const noDelay = async () => {};

  it("retries a 429 and then reads docs", async () => {
    const calls: number[] = [];
    const fetchImpl = async () => {
      calls.push(1);
      if (calls.length === 1) return jsonResponse(429, {});
      return jsonResponse(200, {
        response: { docs: [{ identifier: "ok", date: "1927", mediatype: "texts", title: "Ok" }] },
      });
    };

    const docs = await fetchInternetArchiveDocs(query, 5, fetchImpl, noDelay);
    expect(calls).toHaveLength(2);
    expect(docs).toHaveLength(1);
    expect(docs[0]?.identifier).toBe("ok");
  });

  it("retries a 503 up to three attempts and then throws", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return jsonResponse(503, {});
    };

    await expect(fetchInternetArchiveDocs(query, 5, fetchImpl, noDelay)).rejects.toBeInstanceOf(
      InternetArchiveHttpError,
    );
    expect(calls).toBe(3);
  });

  it("does not retry a 404", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return jsonResponse(404, {});
    };

    await expect(fetchInternetArchiveDocs(query, 5, fetchImpl, noDelay)).rejects.toBeInstanceOf(
      InternetArchiveHttpError,
    );
    expect(calls).toBe(1);
  });
});
