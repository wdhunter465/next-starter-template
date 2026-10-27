import { describe, expect, it } from "vitest";

import {
  ChroniclingAmericaHttpError,
  buildChroniclingAmericaSearchUrl,
  fetchChroniclingAmericaItems,
  issueDate,
  mapChroniclingAmericaItemToCandidateFields,
  ocrExcerpt,
} from "../functions/_lib/content-pipeline-chronicling-america-adapter";

const query = "Lou Gehrig";
const pageUrl = "https://chroniclingamerica.loc.gov/lccn/sn83030214/1927-10-01/ed-1/seq-12/";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("Chronicling America discovery (#4788)", () => {
  it("keeps a real issue date and drops a bare year", () => {
    expect(issueDate("19271001")).toBe("1927-10-01");
    expect(issueDate("1930-12-31")).toBe("1930-12-31");
    expect(issueDate("1927")).toBeNull();
    expect(issueDate("1927-02-31")).toBeNull();
  });

  it("searches the 1920-1930 window one page at a time", () => {
    const url = new URL(buildChroniclingAmericaSearchUrl("Lou Gehrig", 50, 2));
    expect(url.origin + url.pathname).toBe("https://chroniclingamerica.loc.gov/search/pages/results/");
    expect(url.searchParams.get("andtext")).toBe("Lou Gehrig");
    expect(url.searchParams.get("date1")).toBe("1920");
    expect(url.searchParams.get("date2")).toBe("1930");
    expect(url.searchParams.get("rows")).toBe("20");
    expect(url.searchParams.get("page")).toBe("2");
  });

  it("records a sourced pre-1931 issue as public domain, with the page and an OCR excerpt", () => {
    const fields = mapChroniclingAmericaItemToCandidateFields(
      {
        id: pageUrl,
        title: "The New York herald.",
        date: "19271001",
        edition: "1",
        sequence: 12,
        ocr_eng: "the crowd rose when Lou Gehrig stepped in for the second time",
      },
      query,
    );
    expect(fields?.sourceDomain).toBe("loc.gov");
    expect(fields?.dateOrPeriod).toBe("1927-10-01");
    expect(fields?.title).toContain("page 12");
    expect(fields?.rightsStatus).toBe("public_domain_candidate");
    expect(fields?.rightsEvidence.conclusion).toBe("public_domain_confirmed");
    expect(fields?.rightsEvidence.evidence_text).toContain("Issue date: 1927-10-01");
    expect(fields?.rightsEvidence.evidence_text).toContain("Lou Gehrig");
    expect(fields?.provenanceNotes).toContain("newspaper issue record");
    expect(ocrExcerpt("xxxx Lou Gehrig yyyy")).toContain("Lou Gehrig");
  });

  it("keeps a 1931 page and an undated page on the ordinary rights path", () => {
    const later = mapChroniclingAmericaItemToCandidateFields(
      { id: pageUrl, title: "Evening star.", date: "19310603", sequence: 1 },
      query,
    );
    expect(later?.dateOrPeriod).toBe("1931-06-03");
    expect(later?.rightsStatus).toBe("unknown");
    expect(later?.rightsEvidence.conclusion).toBeUndefined();

    const undated = mapChroniclingAmericaItemToCandidateFields({ id: pageUrl, title: "Evening star." }, query);
    expect(undated?.dateOrPeriod).toBeUndefined();
    expect(undated?.rightsStatus).toBe("unknown");
    expect(mapChroniclingAmericaItemToCandidateFields({ title: "No url" }, query)).toBeNull();
  });

  it("retries a 429 and does not retry a 404", async () => {
    const noDelay = async () => {};
    let calls = 0;
    const retried = await fetchChroniclingAmericaItems(query, 5, 1, async () => {
      calls += 1;
      if (calls === 1) return jsonResponse(429, {});
      return jsonResponse(200, { items: [{ id: pageUrl, date: "19270101", title: "Sun." }] });
    }, noDelay);
    expect(calls).toBe(2);
    expect(retried).toHaveLength(1);

    let missing = 0;
    await expect(
      fetchChroniclingAmericaItems(query, 5, 1, async () => {
        missing += 1;
        return jsonResponse(404, {});
      }, noDelay),
    ).rejects.toBeInstanceOf(ChroniclingAmericaHttpError);
    expect(missing).toBe(1);
  });
});
