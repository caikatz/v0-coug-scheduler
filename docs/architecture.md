```mermaid
flowchart TB
    A["Coug Scheduler"] --> B["app/"]
    B --> C["api/"] & D["globals.css"] & n5["layout.tsx"] & n6["page.tsx"] & n7["providers.tsx"] & n8["components/"] & n9["lib/"]
    C --> n1["chat/"] & n3["generate-schedule/"]
    n1 --> n2["route.ts"]
    n3 --> n4["route.ts"]
    n8 --> n10["theme-provider.tsx"] & n11["ui/"]
    n11 --> n12["button.tsx"] & n13["card.tsx"] & n14["dialog.tsx"] & n15["slider.tsx"]
    n9 --> n16["schemas.ts"] & n17["persistence-hooks.ts"] & n18["storage-utils.ts"] & n19["ai-chat-hook.ts"] & n20["schedule-transformer.ts"] & n21["core-utils.ts"] & n22["webhook-service.ts"]
