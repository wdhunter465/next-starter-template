---
Doc Type: Reference
Audience: Product Authority, Operations, and implementation agents
Authority Level: Controlled
Owns: The queued daily social posts for 2026-11-09 to 2026-11-12: topic, final text, photo, alt text, platforms and sources for each day
Does Not Own: The daily post recipe (recorded on #4416); the platform connections and credentials; the design of the unattended posting job (see /docs/reference/operations/social-daily-post-automation-design.md); the 2026-12-01 and 2027-01-01 footer changes (see #2093)
Canonical Reference: /docs/reference/operations/social-crosspost-zapier-payload-contract.md
Related Issues: #5144, #5143, #4416, #4785, #2093
Last Reviewed: 2026-11-12
---

# Social daily post queue, 2026-11-09 to 2026-11-12

## Purpose

Holds the next daily posts, written and checked ahead of time, so a post does not depend on a session being open on the day. A day that is missed is not recovered (Product Authority, 2026-11-08): the 2026-11-06 and 2026-11-07 posts were missed and are not made up.

## How a post goes out

Send at **10:00 AM America/New_York** on its date, to X (Buffer), the Facebook Page "Lou Gehrig Fan Club", Instagram and the Pinterest board "lougehrigfanclub", under the standing authorization of 2026-11-04. The photo address from `/api/photos/list` is a signed link that expires after one hour, so fetch it immediately before posting. Post the same text on every platform. Instagram and Pinterest take the photo only; do not post to the other Page on the same Meta login.

Footer (until 2026-11-30; it changes from 2026-12-01, see #2093): the last two lines of every text are `Explore his story with the Lou Gehrig Fan Club:` and `https://lougehrigfanclub.com`.

## Rules applied (from the recipe on #4416)

1. Facts only, in the club's own words; no copied text, tables or images.
2. One rights-cleared photo from the public list; alt text describes what is visible. A photo may repeat, but not within 4 days of its last use (Product Authority, 2026-11-12, #5173), so the five cleared photos rotate. Instagram is listed only for photos inside its 4:5 to 1.91:1 limits (`instagram_ok_photo_ids` in the queue).
3. A topic is never repeated. Used so far: 2,130 consecutive games and "The Iron Horse" (2026-11-04); the .340 lifetime average and the Hall of Fame plaque (2026-11-05); the 1934 Triple Crown (2026-11-08).
4. Text within 280 characters including the footer.

## Queue

| Date | Photo (id) | Text before the footer | Sources |
| --- | --- | --- | --- |
| Mon 2026-11-09 | 858: souvenir program, "Busting Babes vs. Larruping Lous", Oakland Baseball Park, Sunday, October 23, 1927 | After the 1927 World Series, Lou Gehrig and Babe Ruth hit the road: Gehrig's Larrupin' Lous against Ruth's Bustin' Babes. This program is from their October 23, 1927 game in Oakland. | The program itself (printed date and park); Baseball Hall of Fame collection and SABR accounts of the 1927 barnstorming tour. Sources differ on the length and the game count, so no figure is given. |
| Tue 2026-11-10 | 859: four ballplayers side by side, two in Yankees jerseys and two in jerseys with a large A | On June 3, 1932, Lou Gehrig hit four home runs in one game against the Philadelphia Athletics, the first player of the 20th century to do it. | SABR game project, June 3, 1932; Baseball Hall of Fame, "Lou Gehrig hits four consecutive home runs". The photo is not from that game; the text does not say so. |
| Wed 2026-11-11 | 860: newspaper photo, "Lou Gehrig congratulates Ruth with a little kick after the Babe had made his second homer." | Lou Gehrig hit 23 career grand slams, a major league record until Alex Rodriguez passed him. | Wikipedia, Lou Gehrig; cross-check against Baseball-Reference (one page fetch) before posting. |
| Thu 2026-11-12 | 864: printed portrait page, "Henry Louis 'Lou' Gehrig", International News Photo | On July 4, 1939, the Yankees retired Lou Gehrig's number 4, the first uniform number retired in major league baseball. | Wikipedia, Lou Gehrig; ESPN Classic. Sources word "first" differently (first player, first athlete in any sport); confirm against the Baseball Hall of Fame before posting. |

## Alt text

- **858:** Souvenir program with a decorative border. It reads "Busting Babes vs. Larruping Lous" above a halftone photo of Babe Ruth and Lou Gehrig in Yankees uniforms, each resting a hand on a bat, with "Oakland Baseball Park, Sunday, October 23, 1927" below.
- **859:** Black-and-white photo of four baseball players standing side by side in a ballpark. The two in the middle wear Yankees jerseys and the two on the ends wear jerseys with a large "A". The third player from the left holds a glove.
- **860:** Black-and-white newspaper photo of baseball players at home plate, one raising a leg in a small kick toward another. The printed caption reads: "Lou Gehrig congratulates Ruth with a little kick after the Babe had made his second homer."
- **864:** Black-and-white printed portrait of Lou Gehrig in a cap and baseball jersey, smiling slightly. The page prints "Henry Louis 'Lou' Gehrig. Idol of all American League fans and one of the greatest first basemen of all time. International News Photo."

## Notes and limits

- **Photo supply (updated 2026-11-12):** Product Authority allowed the five cleared photos to repeat with new text, so 2026-11-13 to 2026-11-30 are queued as website-launch posts in `data/social-post-queue.json` (messaging calendar in `data/social-messaging-calendar.json`). The posts from 2026-12-01 wait for the new footer wording (#2093). The earlier note follows: after 2026-11-12 the only unused public rights-cleared photo is 862 (Gehrig and Ruth in "Larrupin' Lous" and "Bustin' Babes" jerseys, same tour as 2026-11-09, so held for a different topic). Photo 856 is flagged as a near-duplicate and held. More days need more cleared photos (#4791, #4794) or Product Authority relaxing the never-reuse rule after a set number of days.
- **Instagram:** photo 864 is taller than Instagram's 4:5 limit and photo 859 is wide. Check the crop before posting, or skip Instagram for that day.
- **Facebook size limit:** a photo must be under 4 MB; photo 864 is about 3.2 MB.
- **Zapier cost:** each day uses 3 of the 100 free monthly tasks (Facebook Page, Instagram, Pinterest); X goes through Buffer.
