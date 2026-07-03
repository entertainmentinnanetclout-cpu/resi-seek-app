# 09. Backend Provider Strategy

## 1. Abstraction Philosophy
To ensure ResKonnect is not permanently locked into a single provider, we follow a service-layer abstraction pattern.

### The Abstraction Layer
```
UI Component (View)
      ↓
Custom Hook (Controller/Service)
      ↓
Shared Lib / Client (Adapter)
      ↓
Supabase / Future API (Provider)
```

## 2. Implementation Rules
1. **No direct `.from()` in Components**: Avoid calling `supabase.from('table')` directly inside JSX components. Use a custom hook (e.g., `useResidences`).
2. **Standardized Responses**: Hooks should return a consistent interface: `{ data, loading, error, refetch }`.
3. **Edge Functions Gateway**: Use the `invokeEdgeFunction` helper to abstract the underlying URL and project ID of the serverless function provider.

## 3. Data Transformation
- Data should be cleaned and transformed at the hook level to match the UI's requirements.
- For example, if a provider returns `is_active`, the hook can map it to `status: 'active' | 'inactive'`.

## 4. Future Providers
When adding a new provider (e.g., a custom Node.js API or a different BaaS):
1. Create a new adapter in `src/integrations/`.
2. Update the custom hooks to switch between adapters based on an environment variable.
3. Ensure the UI remains untouched.
