import { describe, expect, it } from "vitest";

import {
  NaraApiKeyMissingError,
  NARA_ATTRIBUTION,
  buildNaraCatalogSearchUrl,
  fetchNaraCatalogHits,
  mapNaraHitToCandidateFields,
} from "../functions/_lib/content-pipeline-nara-catalog-adapter";

const query = "Lou Gehrig";

function hit(record: Record<string, unknown>, id = "123") {
  return { _id: id, _source: { record } };
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("National Archives Catalog discovery (#4846)", () => {
  it("keeps a copyright date on the pre-1931 path only when the record also states a use restriction", () => {
    const fields = mapNaraHitToCandidateFields(
      hit({
        title: "Universal Newsreel",
        naId: "42",
        useRestriction: { status: "Unrestricted" },
        copyrightDates: [{ logicalDate: "1927-10-01" }],
        productionDates: [{ logicalDate: "1927-09-30" }],
        generalRecordsTypes: ["Moving Images"],
      }),
      query,
    );
    expect(fields?.dateOrPeriod).toBe("1927-10-01");
    expect(fields?.contentType).toBe("video");
    expect(fields?.rightsStatus).toBe("unknown");
    expect(fields?.rightsEvidence).not.toHaveProperty("conclusion");
    expect(fields?.rightsEvidence.evidence_text).toContain("Unrestricted");
    expect(fields?.rightsEvidence.evidence_text).toContain("not a public-domain conclusion");
    expect(fields?.sourceUrl).toBe("https://catalog.archives.gov/id/42");
    expect(fields?.provenanceNotes).toContain(NARA_ATTRIBUTION);
  });

  it("leaves a production-only date and a rights-unknown record off the pre-1931 path", () => {
    const productionOnly = mapNaraHitToCandidateFields(
      hit({
        title: "Newsreel lead",
        useRestriction: { status: "Restricted - Possibly" },
        productionDates: [{ logicalDate: "1928-06-01" }],
      }),
      query,
    );
    expect(productionOnly?.dateOrPeriod).toBeUndefined();
    expect(productionOnly?.rightsEvidence.evidence_text).toContain("Production date: 1928-06-01");

    const noRights = mapNaraHitToCandidateFields(
      hit({ title: "Undeclared", copyrightDates: [{ logicalDate: "1925-01-01" }] }),
      query,
    );
    expect(noRights?.dateOrPeriod).toBeUndefined();

    const later = mapNaraHitToCandidateFields(
      hit({
        title: "Later item",
        useRestriction: { status: "Unrestricted" },
        copyrightDates: [{ logicalDate: "1939-07-04" }],
      }),
      query,
    );
    expect(later?.dateOrPeriod).toBeUndefined();
  });

  it("puts the key in a header and omits it from the URL", () => {
    const url = buildNaraCatalogSearchUrl("Lou Gehrig", 100);
    expect(url.startsWith("https://catalog.archives.gov/api/v2/records/search?")).toBe(true);
    expect(url).not.toContain("api_key");
    expect(url).toContain("limit=20");
  });

  it("sends no request when the key is absent", async () => {
    let calls = 0;
    await expect(
      fetchNaraCatalogHits(query, 5, async () => {
        calls += 1;
        return jsonResponse(200, {});
      }, {}),
    ).rejects.toBeInstanceOf(NaraApiKeyMissingError);
    expect(calls).toBe(0);
  });

  it("retries a 429 and does not put the key in the thrown error", async () => {
    const noDelay = async () => {};
    let calls = 0;
    const hits = await fetchNaraCatalogHits(
      query,
      5,
      async (_url, init) => {
        calls += 1;
        expect((init?.headers as Record<string, string>)["x-api-key"]).toBe("secret-key");
        if (calls === 1) return jsonResponse(429, {});
        return jsonResponse(200, { body: { hits: { hits: [hit({ title: "Ok", naId: "7" })] } } });
      },
      { NARA_CATALOG_API_KEY: "secret-key" },
      noDelay,
    );
    expect(calls).toBe(2);
    expect(hits).toHaveLength(1);
  });
});
