# 12. Component Registry

| Component Name | Location | Purpose | Used By | Reusable |
|----------------|----------|---------|---------|----------|
| `ResidencePropertyCard` | `src/components/findmyres/` | Displays residence summary. | `FindMyRes`, `Landing` | YES |
| `SmartSearchBar` | `src/components/findmyres/` | Advanced filter hero. | `FindMyRes` | YES |
| `StatCard` | `src/components/` | Visualizes numeric metrics. | All Dashboards | YES |
| `StatusBadge` | `src/components/ui/` | Standardized status color. | All | YES |
| `DocumentUploader` | `src/components/` | File upload with preview. | `Profile`, `Applications` | YES |
| `QuickActionCard` | `src/components/` | Icon-based nav shortcut. | God Mode | YES |
| `SectionsManager` | `src/components/admin/` | Hierarchical data editor. | Operations Hub | YES |
| `HeroCarousel` | `src/components/` | Animated landing slides. | `Landing` | NO |
| `FavoriteButton` | `src/components/` | Saves res to user list. | `PropertyCard` | YES |
| `ApplicationStatusCard`| `src/pages/` | Tracker for students. | `Applications` | YES |

## Registration Rule
Before creating a new component, search this registry. If a component exists that satisfies 70% of the needs, **Extend it** rather than duplicating.
