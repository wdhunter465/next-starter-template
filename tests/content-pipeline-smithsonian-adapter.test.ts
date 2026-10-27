import { describe, expect, it } from "vitest";

import {
  SmithsonianApiKeyMissingError,
  SmithsonianHttpError,
  buildSmithsonianSearchUrl,
  fetchSmithsonianRows,
  mapSmithsonianRowToCandidateFields,
} from "../functions/_lib/content-pipeline-smithsonian-adapter";

const query = "Lou Gehrig";

function row(media: unknown, extra: Record<string, unknown> = {}) {
  return {
    id: "nmah_42",
    title: "Gehrig photograph",
    content: {
      descriptiveNonRepeating: {
        title: { content: "Lou Gehrig" },
        record_link: "https://www.si.edu/object/nmah_42",
        online_media: { media },
      },
      indexedStructured: { date: ["1927"] },
    },
    ...extra,
  };
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("Smithsonian Open Access discovery (#4848)", () => {
  it("keeps a record only when the media itself is CC0", () => {
    const fields = mapSmithsonianRowToCandidateFields(
      row([{ type: "Images", content: "https://ids.si.edu/ids/deliveryService?id=42", usage: { access: "CC0" } }]),
      query,
    );
    expect(fields?.originalFileUrl).toContain("ids.si.edu");
    expect(fields?.rightsStatus).toBe("unknown");
    expect(fields?.rightsEvidence).not.toHaveProperty("conclusion");
    expect(fields?.rightsEvidence.evidence_text).toContain("CC0");
    expect(fields?.rightsEvidence.evidence_text).toContain("publicity");
    expect(fields?.provenanceNotes).toContain("Museum date: 1927");
    expect(fields).not.toHaveProperty("dateOrPeriod");
  });

  it("drops metadata-only records and media that is not CC0", () => {
    expect(mapSmithsonianRowToCandidateFields(row(undefined), query)).toBeNull();
    expect(
      mapSmithsonianRowToCandidateFields(
        row([{ content: "https://ids.si.edu/ids/deliveryService?id=9", usage: { access: "Restricted" } }]),
        query,
      ),
    ).toBeNull();
  });

  it("builds a search URL without the key", () => {
    const url = buildSmithsonianSearchUrl("Lou Gehrig", 100);
    expect(url.startsWith("https://api.si.edu/openaccess/api/v1.0/search?")).toBe(true);
    expect(url).toContain("rows=20");
    expect(url).not.toContain("api_key");
  });

  it("sends no request without a key, and a 429 does not echo the key", async () => {
    const noDelay = async () => {};
    let blocked = 0;
    await expect(
      fetchSmithsonianRows(query, 5, async () => {
        blocked += 1;
        return jsonResponse(200, {});
      }, {}),
    ).rejects.toBeInstanceOf(SmithsonianApiKeyMissingError);
    expect(blocked).toBe(0);

    let calls = 0;
    await expect(
      fetchSmithsonianRows(
        query,
        5,
        async (input) => {
          calls += 1;
          expect(String(input)).toContain("api_key=secret-key");
          return jsonResponse(429, {});
        },
        { SMITHSONIAN_API_KEY: "secret-key" },
        noDelay,
      ),
    ).rejects.toBeInstanceOf(SmithsonianHttpError);
    expect(calls).toBe(3);
  });
});
