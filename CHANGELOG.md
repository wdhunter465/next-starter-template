# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
- Photo upload check no longer rejects ordinary JPEGs for the chance byte pair "<%"; a JPEG is searched for hidden code only in its header segments and after the image end, and appended code beyond the first 64 KiB is now caught (#5477)
- Bulk photo upload shows a thumbnail on every row that did not upload, so a failed picture can be recognised by sight (#5475)
- Admin Photos page (`/admin/photos`) to block and restore a photo, the takedown path for the all-B2-photos decision (#5471)
- All B2 photos are used on the website and in social posts; only `blocked` or `copyright_restricted` photos are withheld (Product Authority decision 2026-11-23, #5467)
- Documentation restructured to Diátaxis-aligned architecture
- Governance guardrails reorganized
