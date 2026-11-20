import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  ChroniclingAmericaHttpError,
  buildChroniclingAmericaSearchUrl,
  buildChroniclingResourceFoJsonUrl,
  extractChroniclingSearchResults,
  fetchChroniclingAmericaItems,
  issueDate,
  issueDateFromPageUrl,
  mapChroniclingAmericaItemToCandidateFields,
  ocrExcerpt,
  pageImageFromChroniclingPageJson,
  pickChroniclingImageUrl,
  pickChroniclingPageUrl,
} from "../functions/_lib/content-pipeline-chronicling-america-adapter";

const query = "Lou Gehrig";
const classicPageUrl = "https://chroniclingamerica.loc.gov/lccn/sn83030214/1927-10-01/ed-1/seq-12/";
const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/chronicling-america");
const searchFixture = JSON.parse(readFileSync(join(fixturesDir, "loc-collection-search-sample.json"), "utf8"));
const pageFixture = JSON.parse(readFileSync(join(fixturesDir, "page-json-sample.json"), "utf8"));

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe("Chronicling America discovery (#4788 / #5110)", () => {
  it("keeps a real issue date and drops a bare year", () => {
    expect(issueDate("19271001")).toBe("1927-10-01");
    expect(issueDate("1930-12-31")).toBe("1930-12-31");
    expect(issueDate("1927")).toBeNull();
    expect(issueDate("1927-02-31")).toBeNull();
    expect(issueDateFromPageUrl(classicPageUrl)).toBe("1927-10-01");
  });

  it("searches the loc.gov Chronicling America collection JSON API", () => {
    const url = new URL(buildChroniclingAmericaSearchUrl("Lou Gehrig", 50, 2));
    expect(url.origin + url.pathname).toBe("https://www.loc.gov/collections/chronicling-america/");
    expect(url.searchParams.get("q")).toBe("Lou Gehrig");
    expect(url.searchParams.get("fo")).toBe("json");
    expect(url.searchParams.get("c")).toBe("20");
    expect(url.searchParams.get("sp")).toBe("2");
    expect(url.searchParams.get("dates")).toBe("1920/1930");
  });

  it("maps a captured loc.gov collection hit (real fixture) to a newspaper photo candidate", () => {
    const hit = extractChroniclingSearchResults(searchFixture)[0];
    expect(hit).toBeTruthy();
    expect(searchFixture._lgfc_capture?.http_status).toBe(200);
    expect(searchFixture._lgfc_capture?.source_url).toContain("www.loc.gov/collections/chronicling-america/");

    const fields = mapChroniclingAmericaItemToCandidateFields(hit, query);
    expect(fields?.sourceDomain).toBe("loc.gov");
    expect(fields?.contentType).toBe("photo");
    expect(fields?.qualityTier).toBe("newspaper");
    expect(fields?.dateOrPeriod).toBe("1928-10-08");
    expect(fields?.title).toContain("page 7");
    expect(fields?.rightsStatus).toBe("public_domain_candidate");
    expect(fields?.rightsEvidence.conclusion).toBe("public_domain_confirmed");
    expect(fields?.sourceUrl).toContain("www.loc.gov/resource/");
    expect(fields?.imageUrl).toMatch(/^https:\/\/tile\.loc\.gov\//);
    expect(fields?.imageUrl).not.toContain("thumbnail.jpg");
    expect(fields?.provenanceNotes).toContain("loc.gov collection search");
    expect(ocrExcerpt("xxxx Lou Gehrig yyyy")).toContain("Lou Gehrig");
  });

  it("prefers www.loc.gov/resource over classic wrappers and picks the largest search image", () => {
    expect(
      pickChroniclingPageUrl({
        id: "http://www.loc.gov/resource/sn83045293/1928-10-08/ed-1/?sp=7",
        url: "https://www.loc.gov/item/sn83030214/",
      }),
    ).toBe("https://www.loc.gov/resource/sn83045293/1928-10-08/ed-1/?sp=7");

    const image = pickChroniclingImageUrl({
      image_url: [
        "https://tile.loc.gov/image-services/iiif/service:x/full/pct:3.125/0/default.jpg#h=303&w=222",
        "https://tile.loc.gov/image-services/iiif/service:x/full/pct:6.25/0/default.jpg#h=607&w=445",
      ],
    });
    expect(image).toContain("pct:6.25");
    expect(image).not.toContain("#");
  });

  it("keeps a 1931 page and an undated page on the ordinary rights path", () => {
    const later = mapChroniclingAmericaItemToCandidateFields(
      {
        id: "https://chroniclingamerica.loc.gov/lccn/sn83045462/1931-06-03/ed-1/seq-1/",
        title: "Evening star.",
        date: "19310603",
        sequence: 1,
      },
      query,
    );
    expect(later?.dateOrPeriod).toBe("1931-06-03");
    expect(later?.rightsStatus).toBe("unknown");
    expect(later?.rightsEvidence.conclusion).toBeUndefined();

    const undated = mapChroniclingAmericaItemToCandidateFields({ id: classicPageUrl, title: "Evening star." }, query);
    // Date recovered from the page URL path.
    expect(undated?.dateOrPeriod).toBe("1927-10-01");
    expect(mapChroniclingAmericaItemToCandidateFields({ title: "No url" }, query)).toBeNull();
  });

  it("extracts results from loc.gov collection JSON and retries a 429", async () => {
    expect(extractChroniclingSearchResults(searchFixture).length).toBeGreaterThan(0);

    const noDelay = async () => {};
    let calls = 0;
    const retried = await fetchChroniclingAmericaItems(
      query,
      5,
      1,
      async () => {
        calls += 1;
        if (calls === 1) return jsonResponse(429, {});
        return jsonResponse(200, { results: [{ id: classicPageUrl, date: "19270101", title: "Sun." }] });
      },
      noDelay,
    );
    expect(calls).toBe(2);
    expect(retried).toHaveLength(1);

    let missing = 0;
    await expect(
      fetchChroniclingAmericaItems(
        query,
        5,
        1,
        async () => {
          missing += 1;
          return jsonResponse(404, {});
        },
        noDelay,
      ),
    ).rejects.toBeInstanceOf(ChroniclingAmericaHttpError);
    expect(missing).toBe(1);
  });

  it("builds www.loc.gov resource fo=json URLs and reads jp2 from the captured page JSON", () => {
    expect(buildChroniclingResourceFoJsonUrl(classicPageUrl)).toBe(
      "https://www.loc.gov/resource/sn83030214/1927-10-01/ed-1/?sp=12&fo=json",
    );
    expect(
      buildChroniclingResourceFoJsonUrl("http://www.loc.gov/resource/sn83045293/1928-10-08/ed-1/?sp=7"),
    ).toBe("https://www.loc.gov/resource/sn83045293/1928-10-08/ed-1/?sp=7&fo=json");

    const image = pageImageFromChroniclingPageJson(pageFixture, classicPageUrl);
    expect(image).toMatch(/\.jp2$/);
    expect(image).toContain("tile.loc.gov");
    expect(pageImageFromChroniclingPageJson({}, classicPageUrl)).toBeNull();
  });
});
