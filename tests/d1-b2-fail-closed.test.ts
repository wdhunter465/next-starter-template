import { describe, expect, it, vi } from "vitest";

import { requireB2, parseListObjectsV2Xml } from "../functions/_lib/b2";
import { requireD1 } from "../functions/_lib/d1";
import { normalizePhotoUrl } from "../functions/_lib/photo-url";
import { onRequestGet as getFriends } from "../functions/api/friends/list";
import { onRequestGet as getMilestones } from "../functions/api/milestones/list";

type QueryResult = { results?: Array<Record<string, unknown>> };

function createRequest(path = "/api/test"): Request {
  return new Request(`https://www.lougehrigfanclub.com${path}`);
}

function createD1(resolver: (sql: string, args: unknown[]) => QueryResult | Promise<QueryResult>) {
  return {
    prepare: vi.fn((sql: string) => ({
      all: () => Promise.resolve(resolver(sql, [])),
      bind: (...args: unknown[]) => ({
        all: () => Promise.resolve(resolver(sql, args)),
      }),
    })),
  };
}

describe("D1 fail-closed guards", () => {
  it("returns a 503 guard result when the D1 binding is missing", () => {
    const result = requireD1({});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.body).toMatchObject({
        ok: false,
        error: "Database unavailable",
      });
    }
  });

  it("returns 503 for homepage milestones when D1 is unavailable", async () => {
    const response = await getMilestones({
      env: {},
      request: createRequest("/api/milestones/list"),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Database unavailable",
    });
  });

  it("returns 503 for friends when D1 is unavailable", async () => {
    const response = await getFriends({
      env: {},
      request: createRequest("/api/friends/list"),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Database unavailable",
    });
  });

  it("returns 503 for milestones when required D1 tables are missing", async () => {
    const DB = createD1(() => ({ results: [] }));

    const response = await getMilestones({
      env: { DB },
      request: createRequest("/api/milestones/list"),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Database schema incomplete",
      missingTables: ["milestones", "photos"],
    });
  });

  it("returns 503 for friends when the required D1 table is missing", async () => {
    const DB = createD1(() => ({ results: [] }));

    const response = await getFriends({
      env: { DB },
      request: createRequest("/api/friends/list"),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Database schema incomplete",
      missingTables: ["friends"],
    });
  });
});

describe("B2 fail-closed guards", () => {
  it("returns a 503 response when B2 secrets are missing", async () => {
    const result = requireB2({});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(503);
      await expect(result.response.json()).resolves.toMatchObject({
        ok: false,
        error: "B2 secrets missing for this Pages environment",
      });
    }
  });

  it("parses B2 ListObjectsV2 XML without throwing on encoded keys", () => {
    const objects = parseListObjectsV2Xml(`
      <ListBucketResult>
        <Contents>
          <Key>photos/Lou &amp; Eleanor.jpg</Key>
          <LastModified>2026-06-01T00:00:00.000Z</LastModified>
          <ETag>&quot;abc123&quot;</ETag>
          <Size>42</Size>
        </Contents>
      </ListBucketResult>
    `);

    expect(objects).toEqual([
      {
        key: "photos/Lou & Eleanor.jpg",
        size: 42,
        etag: "abc123",
        fileId: "abc123",
        lastModified: "2026-06-01T00:00:00.000Z",
      },
    ]);
  });
});

describe("B2 photo URL normalization", () => {
  const request = createRequest("/");

  it("repairs stored Backblaze S3 URLs missing the public bucket path", () => {
    expect(
      normalizePhotoUrl({
        rawUrl: "https://s3.us-east-005.backblazeb2.com/photos/lou.jpg",
        request,
      }),
    ).toBe("https://s3.us-east-005.backblazeb2.com/LouGehrigFanClub/photos/lou.jpg");
  });

  it("builds public B2 URLs from object keys", () => {
    expect(
      normalizePhotoUrl({
        rawUrl: "photos/lou.jpg",
        request,
        publicB2BaseUrl: "https://cdn.example.com/lgfc",
      }),
    ).toBe("https://cdn.example.com/lgfc/photos/lou.jpg");
  });

  it("falls back to site-relative URLs when no public B2 base is configured", () => {
    expect(
      normalizePhotoUrl({
        rawUrl: "photos/lou.jpg",
        request,
      }),
    ).toBe("https://www.lougehrigfanclub.com/photos/lou.jpg");
  });

  it("returns an empty string for missing media values", () => {
    expect(normalizePhotoUrl({ rawUrl: null, request })).toBe("");
    expect(normalizePhotoUrl({ rawUrl: "   ", request })).toBe("");
  });
});

describe("homepage D1/B2 media responses", () => {
  it("normalizes milestone photo URLs before returning homepage data", async () => {
    const DB = createD1((sql) => {
      if (sql.includes("sqlite_master")) {
        return { results: [{ name: "milestones" }, { name: "photos" }] };
      }

      if (sql.includes("PRAGMA table_info")) {
        return { results: [{ name: "year" }] };
      }

      return {
        results: [
          {
            id: 1,
            year: 1939,
            title: "Luckiest Man",
            description: "Farewell address",
            photo_url: "milestones/farewell.jpg",
          },
        ],
      };
    });

    const response = await getMilestones({
      env: { DB, PUBLIC_B2_BASE_URL: "https://cdn.example.com/lgfc/" },
      request: createRequest("/api/milestones/list?limit=1"),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      items: [
        {
          photo_url: "https://cdn.example.com/lgfc/milestones/farewell.jpg",
        },
      ],
    });
  });

  it("normalizes friends photo URLs before returning homepage data", async () => {
    const DB = createD1((sql) => {
      if (sql.includes("sqlite_master")) {
        return { results: [{ name: "friends" }] };
      }

      return {
        results: [
          {
            id: 7,
            name: "Live Like Lou Foundation",
            kind: "Partner",
            blurb: "ALS awareness",
            url: "https://www.livelikelou.org",
            photo_url: "friends/live-like-lou.png",
          },
        ],
      };
    });

    const response = await getFriends({
      env: { DB, PUBLIC_B2_BASE_URL: "https://cdn.example.com/lgfc" },
      request: createRequest("/api/friends/list"),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      items: [
        {
          photo_url: "https://cdn.example.com/lgfc/friends/live-like-lou.png",
        },
      ],
    });
  });
});

describe("#4344 friends list surfaces", () => {
  const catalog = [
    { id: 6, name: "I AM ALS", url: "https://www.iamals.org/" },
    { id: 2, name: "Live Like Lou Foundation", url: "https://www.livelikelou.org" },
    { id: 7, name: "LouGehrig.com", url: "https://lougehrig.com/" },
    { id: 1, name: "Luckiest Man: The Life and Death of Lou Gehrig", url: "https://www.jonathaneig.com/luckiest-man-the-life-and-death-of-lou-gehrig" },
    { id: 5, name: "Phi Delta Theta — Lou Gehrig Award", url: "https://museum.phideltatheta.org/lou-gehrig-award/" },
    { id: 3, name: "ALS Cure Project", url: "https://www.alscure.org" },
    { id: 4, name: "They Played In Color", url: "https://www.theyplayedincolor.com/" },
    { id: 8, name: "The Lou Gehrig Society", url: "https://www.thelougehrigsociety.org/" },
  ];

  function friendsDb() {
    return createD1((sql) => {
      if (sql.includes("sqlite_master")) {
        return { results: [{ name: "friends" }] };
      }
      return { results: catalog };
    });
  }

  it("replaces LouGehrig.com with The Lou Gehrig Society on the homepage surface", async () => {
    const response = await getFriends({
      env: { DB: friendsDb() },
      request: createRequest("/api/friends/list?surface=homepage"),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items.map((row: { name: string }) => row.name)).toEqual([
      "ALS Cure Project",
      "I AM ALS",
      "Live Like Lou Foundation",
      "The Lou Gehrig Society",
      "Luckiest Man: The Life and Death of Lou Gehrig",
      "Phi Delta Theta — Lou Gehrig Award",
      "They Played In Color",
    ]);
  });

  it("inserts The Lou Gehrig Society second on Club Home and keeps LouGehrig.com", async () => {
    const response = await getFriends({
      env: { DB: friendsDb() },
      request: createRequest("/api/friends/list?surface=club-home"),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items.map((row: { name: string }) => row.name)).toEqual([
      "ALS Cure Project",
      "The Lou Gehrig Society",
      "I AM ALS",
      "Live Like Lou Foundation",
      "LouGehrig.com",
      "Luckiest Man: The Life and Death of Lou Gehrig",
      "Phi Delta Theta — Lou Gehrig Award",
      "They Played In Color",
    ]);
  });
});

