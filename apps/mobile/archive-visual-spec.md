# Archive visual trace — iPhone 16 Pro

Reference under comparison: Figma frame `205:272`, “Archive — Pixel Trace / iPhone 16 Pro”, exported at 402 × 874. This is a measurement record for the Archive implementation, not a new design specification. If the user supplies a newer screenshot, that screenshot supersedes this frame.

| Element | Reference geometry / styling |
| --- | --- |
| Canvas | 402 × 874; near-black `#020504` → `#030705` → `#010302` vertical background. |
| Header | Back button 41 × 41 at (29, 61); title starts (82, 66), Inter Bold 28, line-height 38; active signal (280, 62) 68 × 38; more glyph (354, 68) 24 × 24. |
| Filters | Top 124, height 34. Folders x29 w96; Tags x132 w92; Small x231 w97; Search x337 w34. Radius 19 for chips, 1px low-opacity white border, 8px background blur, labels 10px. |
| Arc and drag hint | Arc graphic x−19 y202 w442 h78; fine emerald stroke. Hint at approximately (235, 215), 30 × 30, centered ↔, serves as drag affordance only. |
| Folder stream | Clipped viewport x0 y202 w402 h335. Seven visible folder groups, each approximately 90 × 318. |
| Folder origins | Travel (−14, −22), Learning (42, −13), Projects (99, −1), Compliance (155, 10), Media (211, 24), Ideas (267, 36), Notes (323, 48), all relative to stream. Nominal x step 56–57; y follows a deliberate downward track. |
| Folder shape and depth | Exact exported front and rear face silhouettes from the Figma groups. The front face has a tab and softly rounded bottom. The rear face is offset by a few pixels; no freehand reinterpretation of its polygon. White faces are milky/frosted with soft luminous edges; one embedded green Compliance face is selected. |
| Folder labels | Attached to the lower portion of each plane, following its −61°/skewed perspective. Reference uses Inter Bold text inside the transformed folder group, not horizontal list labels. |
| Layering | Neighboring folder planes overlap. Render depth order must follow the visual stream and stay stable during drag. One and only one green folder at the fixed center focus. |
| Selected info card | x26 y537 w350 h164, radius 26; dark green glass, soft 11px blur, ~1px low-opacity emerald border and diffused shadow. Icon tile x44 y555 w68 h68. Text block begins x130; FOLDER 10px semibold, title 18.5px bold, description 11px / 17px lines. Metadata row near y670. |
| Bottom input | x22 y759 w358 h66, radius 33; attachment 50 × 50 at local (7,7), text field 226 × 46 at (65,9), microphone 52 × 52 at (297,6). Emerald accent only on microphone and fine edges. |

Initial screenshot comparison against the existing Expo implementation: the header, filters, information card, and bottom bar are approximately positioned, but the folder planes are too narrow, too gray, and too visually separate. Their labels lack the reference's skewed attachment to the plane. The folder artwork and overlap are the primary static corrections; interaction tuning follows only after a close static match.
