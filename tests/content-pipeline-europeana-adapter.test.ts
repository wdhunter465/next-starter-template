import { describe, expect, it } from "vitest";

import {
  EuropeanaApiKeyMissingError,
  buildEuropeanaSearchUrl,
  fetchEuropeanaItems,
  mapEuropeanaItemToCandidateFields,
} from "../functions/_lib/content-pipeline-europeana-adapter";

const query = "Lou Gehrig";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("Europeana tour discovery (#4847)", () => {
  it("keeps a CC0 record and its rights statement", () => {
    const fields = mapEuropeanaItemToCandidateFields(
      {
        id: "/202/gehrig-1934",
        title: ["Gehrig in Tokyo"],
        rights: ["https://creativecommons.org/publicdomain/zero/1.0/"],
        dataProvider: ["National Diet Library"],
        type: "IMAGE",
        dctermsIssued: "1934-11-02",
      },
      query,
    );
    expect(fields?.rightsEvidence.evidence_text).toContain("publicdomain/zero/1.0");
    expect(fields?.rightsEvidence.conclusion).toBe("public_domain_confirmed");
    expect(fields?.dateOrPeriod).toBe("1934-11-02");
    expect(fields?.contentType).toBe("photo");
  });

  it("excludes a restricted record, a missing rights statement, and a bare year", () => {
    expect(
      mapEuropeanaItemToCandidateFields(
        { id: "/1/by", title: ["Credit required"], rights: ["http://creativecommons.org/licenses/by/4.0/"] },
        query,
      ),
    ).toBeNull();
    expect(mapEuropeanaItemToCandidateFields({ id: "/1/none", title: ["No rights"] }, query)).toBeNull();

    const yearOnly = mapEuropeanaItemToCandidateFields(
      {
        id: "/1/pdm",
        title: ["Tour"],
        rights: ["http://creativecommons.org/publicdomain/mark/1.0/"],
        year: ["1931"],
      },
      query,
    );
    expect(yearOnly?.dateOrPeriod).toBeUndefined();
    expect(yearOnly?.rightsEvidence.conclusion).toBe("public_domain_confirmed");
  });

  it("limits the search URL to 1931 and 1934 and omits the key", () => {
    const url = buildEuropeanaSearchUrl("Lou Gehrig", 100);
    expect(url.startsWith("https://api.europeana.eu/record/v2/search.json?")).toBe(true);
    expect(url).toContain("YEAR%3A1931+OR+YEAR%3A1934");
    expect(url).toContain("rows=20");
    expect(url.toLowerCase()).not.toContain("wskey");
  });

  it("sends no request without the project key", async () => {
    let calls = 0;
    await expect(
      fetchEuropeanaItems(query, 5, async () => {
        calls += 1;
        return jsonResponse(200, {});
      }, {}),
    ).rejects.toBeInstanceOf(EuropeanaApiKeyMissingError);
    expect(calls).toBe(0);
  });
});
