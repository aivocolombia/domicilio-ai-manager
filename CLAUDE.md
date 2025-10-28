# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build for development mode
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build
- `npm start` - Serve production build

### Installation
- `npm i` - Install dependencies

### Code Quality & Performance
- Lazy loading implemented for heavy components (AdminPanel, TimeMetricsPage)
- Custom logging system available via `@/utils/logger.ts` with configurable levels
- Optimized async state management via `@/hooks/useAsyncState.ts`
- Bundle optimization: removed unused UI components (breadcrumb, carousel, command, drawer, pagination, sidebar)
- Error boundaries for robust error handling (`ErrorBoundary.tsx`)
- Performance monitoring with `PerformanceMonitor.tsx`

## Architecture Overview

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: shadcn/ui (Radix UI + Tailwind CSS)
- **Database**: Supabase (PostgreSQL)
- **State Management**: React Query + Context API
- **Authentication**: Custom nickname-based authentication (profiles table)
- **Routing**: React Router v6

### Project Structure

#### Core Application Components
- `src/App.tsx` - Main app with routing and providers
- `src/pages/Index.tsx` - Main dashboard page  
- `src/components/` - UI components organized by feature
- `src/hooks/` - Custom React hooks
- `src/services/` - API service layers
- `src/types/` - TypeScript type definitions

#### Key Components
- `Login.tsx` - Authentication form
- `ProtectedRoute.tsx` - Route protection with role-based access
- `AdminPanel.tsx` - Administrator interface (lazy loaded)
- `Dashboard.tsx` - Main dashboard with sorting, pagination (15 items/page), and filtering
- `Inventory.tsx` - Product/menu management
- `CallCenter.tsx` - Order management interface
- `DeliveryPersonnel.tsx` - Delivery staff management
- `StatusBar.tsx` - Dynamic system status display with inventory alerts
- `TimeMetricsPage.tsx` - Time metrics analysis (lazy loaded)
- `Loading.tsx` - Reusable loading component for lazy loaded modules

#### Authentication System
- `useAuth.tsx:1-146` - Authentication context and hooks
- `customAuthService.ts` - Core authentication service with nickname-based login
- Role-based access: `agent`, `admin_punto`, and `admin_global` roles
- Profile management with local session storage
- Demo accounts: Various nickname-based accounts (see profiles table)

### Database Architecture

#### Core Business Tables
- `platos` - Menu dishes/plates
- `bebidas` - Beverages  
- `toppings` - Additional toppings/sides
- `plato_toppings` - Many-to-many relationship between dishes and toppings
- `profiles` - User profiles with roles and sede assignments
- `sedes` - Restaurant locations/branches

#### Sede-Specific Inventory System
The system supports multi-location inventory management:
- `sede_platos` - Dish availability/pricing per location
- `sede_bebidas` - Beverage availability/pricing per location
- `sede_toppings` - Topping availability/pricing per location

#### Order Management Tables
- `ordenes` - Orders with customer, delivery, payment info
- `ordenes_platos` - Order line items for dishes
- `ordenes_bebidas` - Order line items for beverages
- `ordenes_toppings` - Toppings applied to order items
- `clientes` - Customer information
- `repartidores` - Delivery personnel
- `pagos` - Payment records
- `minutas` - Daily order tracking per sede with daily_id counter
- `daily_minuta_counters_sede` - Daily counter per sede for order numbering

#### Additional Tables
- `product_substitutions` - Tracks product substitutions across orders
- `substitution_history` - Historical record of all substitutions
- `topping_substitutions` - Topping-specific substitution tracking

### Service Layer Architecture

All services follow a **class-based singleton pattern** with static instantiation for reusability across the application.

#### Key Services

**MenuService** (`src/services/menuService.ts`)
- CRUD operations for platos, bebidas, toppings
- Sede-specific availability management (`updatePlatoSedeAvailability`, `updateBebidaSedeAvailability`, `updateToppingSedeAvailability`)
- Timeout handling and error management
- Complex joins for dish-topping relationships
- `getMenuConSede()` - fetches menu with sede-specific availability and pricing

**DashboardService** (`src/services/dashboardService.ts`)
- Fetch and filter orders for dashboard display
- Validates `sede_id` as UUID (required parameter)
- Supports filtering by: status, date range, order type (delivery/pickup), sede_id
- Returns `DashboardOrder` objects with joined client, payment, and delivery data
- Timezone-aware date handling for Colombia (UTC-5)

**AdminService** (`src/services/adminService.ts`)
- User CRUD operations with hashed password management
- Sede management (create/update/delete locations)
- Repartidor (delivery person) management
- Permission checks via `customAuthService`
- Role-based user creation

**Other Specialized Services**:
- `deliveryService.ts` - Delivery personnel and routing
- `orderStatusService.ts` - Order status transitions
- `discountService.ts` - Discount application and tracking
- `metricsService.ts` - Analytics and reporting
- `crmService.ts` - Customer relationship management
- `sedeOrdersService.ts` - Orders filtered by sede
- `minutaService.ts` - Daily order summaries and tracking
- `multiPaymentService.ts` - Multi-payment order support
- `substitutionService.ts` & `substitutionHistoryService.ts` - Product substitution tracking
- `addressService.ts` - Customer address management

#### Authentication Flow
1. User login via `signIn()` in `useAuth.tsx` using nickname/password
2. Custom authentication service validates credentials against `profiles` table using PostgreSQL's crypt function
3. Session token created (base64-encoded JSON with 24-hour expiry)
4. User data stored in memory and localStorage for session persistence
5. Route protection in `ProtectedRoute.tsx` with role-based access
6. Role-based permissions throughout app via `usePermissions.ts`
7. Session restored automatically on app reload via `restoreSession()`

### Key Features

#### Multi-Sede Support
- Each user is assigned to a specific sede (location)
- Inventory management is sede-specific
- Products can have different availability/pricing per sede
- Fallback to base pricing if no sede-specific pricing exists

#### User Management
- Admin users can create user profiles via `AdminPanel`
- Custom user management without requiring external auth registration
- Role-based permissions: `admin_global` (full access), `admin_punto` (sede-specific admin), `agent` (limited access)

#### Order Management System
- Complete order lifecycle from creation to delivery
- Customer information management
- Delivery personnel assignment and tracking
- Payment processing integration
- ETA management with update tracking

### Important Configuration

#### Environment Variables
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

#### Database Setup
- Execute SQL scripts in root directory for initial setup
- `populate_sede_tables.sql` - Initialize sede-specific inventory
- `create_user_secure.sql` - User creation function
- Various debug and verification scripts available

### Development Guidelines

#### Working with Sede System
- Always check user's `sede_id` before inventory operations
- Use sede-specific tables (`sede_platos`, etc.) for availability
- Fallback to base product info when sede data unavailable

#### Authentication Testing
- Use provided demo accounts for testing different roles
- Check `profiles` table for available nicknames and roles
- `admin_global` role required for user management functions
- `agent` role has limited access to inventory management only
- Authentication is nickname-based, no external auth provider needed

#### Database Patterns
- Use service classes for database operations
- Implement timeout handling for all database calls
- Create temporary profiles as fallbacks for auth issues
- Follow existing patterns for error handling and loading states

### Common Workflows

#### Adding New Menu Items
1. Use `MenuService` to add items to base tables (`platos`, `bebidas`, `toppings`)
2. Populate sede-specific tables for availability per location
3. Update TypeScript types in `src/types/menu.ts`

#### User Management
1. Admin creates profile via `AdminPanel`
2. Profile stored in `profiles` table with nickname, password hash, and role
3. User can immediately login with assigned nickname and password
4. No external auth registration required

#### Order Processing
1. Orders created through `CallCenter` component
2. Assigned to delivery personnel via `DeliveryPersonnel`
3. Status tracking through order lifecycle
4. ETA management with update counting

#### Order Cancellation System
1. **Cancel Order**: From dashboard, admin/agents can cancel orders with mandatory reason
2. **View Cancellation Reason**: Orange "Ver motivo" button appears for cancelled orders
3. **Admin Analytics**: AdminPanel shows cancelled orders counter with breakdown by sede
4. **Detailed Report**: Click counter to see full table with cancellation reasons and timestamps
5. Cancellation reason stored in `motivo_cancelacion` field with timestamp

#### Multi-Payment Support
- Orders can have `payment_id` and `payment_id_2` for split payments
- Handled by `multiPaymentService.ts`
- Useful for partial cash/card payments

#### Minuta System (Daily Order Tracking)
- Each order linked to a minuta via `daily_id` field
- `daily_minuta_counters_sede` table tracks daily counter per sede
- Enables daily order summaries and reporting
- Format: "1", "2", "3" for orders in a day

#### Product Substitution Tracking
- `substitutionService.ts` manages substitutions
- `substitution_history` table tracks all historical substitutions
- Supports substitutions for platos, bebidas, and toppings
- Used for inventory management and analytics

### New Features & Optimizations (Recent Updates)

#### Dashboard Enhancements
- **Sorting**: Click column headers to sort by any field (ascending/descending)
- **Pagination**: 15 orders per page with navigation controls and page numbers
- **Date Filters**: Fixed timezone issues - now correctly filters by Colombia timezone
- **CSV Export**: Corrected all field mappings to eliminate undefined values

#### StatusBar Intelligence
- **Dynamic Icons**: Changes based on operational status (critical/activity/OK)
- **Inventory Alerts**: Shows specific counts "2 platos, 1 topping" when items are out of stock
- **Color Coding**: Red background for critical issues, blue for activity, green for all OK
- **Smart Messaging**: Context-aware status messages instead of generic text

#### Performance Optimizations
- **Lazy Loading**: AdminPanel and TimeMetricsPage load on-demand
- **Bundle Reduction**: Removed unused UI components (~15-20KB savings)
- **Async State Management**: New `useAsyncState` hook for consistent loading/error patterns
- **Logging System**: Configurable logger in `@/utils/logger.ts` for development/production

### Development Best Practices

#### Code Organization
- Use lazy loading for heavy components (AdminPanel, TimeMetricsPage are examples)
- Implement `useAsyncState` hook for consistent loading/error state management
- Use the centralized logger instead of console.log statements
- Follow established patterns for service classes in `/services` directory

#### Performance Guidelines
- All database operations should use service classes with timeout handling
- Implement pagination for large data sets (15 items per page is standard)
- Use Suspense boundaries for lazy-loaded components
- Prefer memoization for expensive calculations in complex components

#### UI/UX Standards
- StatusBar should show dynamic content based on actual system state
- Use consistent loading states across all components (Loading component available)
- Implement proper error boundaries for robust user experience
- Color coding: Red for critical issues, Blue for activity, Green for OK states

#### Database Integration
- Always handle timezone correctly for Colombia (UTC-5)
- Store cancellation reasons in `motivo_cancelacion` field with timestamp
- Use proper field mapping for CSV exports to avoid undefined values
- Implement real-time subscriptions for inventory updates where appropriate

#### Quality Assurance
- Bundle optimization: Check for unused imports and components regularly
- Use centralized logger instead of console.log statements
- Validate async state patterns are consistent across components using `useAsyncState`
- Test lazy loading boundaries with slow network conditions
- Monitor performance using built-in `PerformanceMonitor` component

### Current Authentication Architecture (IMPORTANT)

#### Custom Authentication System
The application now uses a **custom nickname-based authentication system** instead of Supabase Auth:

- **Authentication Service**: `src/services/customAuthService.ts`
  - Handles login/logout via nickname and password
  - Validates credentials against `profiles` table directly
  - Manages local session storage
  - Provides role-based permission checks

- **User Profiles Table Schema**:
  ```typescript
  interface Profile {
    id: string // uuid
    nickname: string // unique login identifier
    display_name: string // full name
    password_hash: string // bcrypt hashed password
    role: 'agent' | 'admin_punto' | 'admin_global'
    sede_id: string // uuid - required for all users
    is_active: boolean
  }
  ```

- **Role Hierarchy**:
  - `agent`: Basic access, sede-specific operations only
  - `admin_punto`: Administrative access for specific sede
  - `admin_global`: Full system access, can manage all sedes

#### Authentication Flow Details
1. User enters nickname/password in login form
2. `customAuthService.signIn()` validates against `profiles` table
3. Password verification using stored hash
4. On success, user data stored in memory and localStorage
5. `useAuth` hook provides authentication state throughout app
6. `ProtectedRoute` validates authentication and role permissions

### Modern Development Patterns

#### Async State Management
- **Hook**: `useAsyncState<T>()` - Standardized async operation handling
- **Pattern**: Consistent loading/error/data states across components
- **Usage**: Replace manual useState patterns for async operations

#### Logging System
- **Centralized Logger**: `@/utils/logger.ts`
- **Environment-aware**: Debug level in development, warn+ in production
- **Categories**: Structured logging with category prefixes
- **Usage**: `logDebug('category', 'message', optionalData)`

#### Performance Optimizations
- **Lazy Loading**: Critical for heavy components (AdminPanel, TimeMetricsPage)
- **Query Optimization**: React Query with optimized cache settings
- **Bundle Analysis**: Regular cleanup of unused UI components
- **Error Boundaries**: Prevent crashes from component failures

### Custom Hooks & State Management

The application uses specialized React hooks for consistent state management patterns:

#### Core Hooks

**useAuth** (`src/hooks/useAuth.tsx`)
- Global authentication state and methods
- Returns: `user`, `loading`, `signIn()`, `signOut()`, `refreshProfile()`
- Automatically restores session on app load

**useAsyncState** (`src/hooks/useAsyncState.ts`)
- Standardized async operation handling
- Returns: `data`, `loading`, `error`, `setters`, `execute()`
- Use this for all async operations to maintain consistency

**usePermissions** (`src/hooks/usePermissions.ts`)
- Derives permissions from user role
- Returns: permissions matrix, `canAccessResource()`, role checks
- Role mapping: `admin_global` → `admin`, `admin_punto` → `administrador_punto`, `agent` → `agent`

**useDashboard** (`src/hooks/useDashboard.ts`)
- Fetches orders with real-time updates
- Handles filters: estado, sede_id, date range
- Pagination support (15 items/page)

**useMenu** (`src/hooks/useMenu.ts`)
- Fetches menu with sede-specific availability
- Caching via React Query

**useSedeOrders** (`src/hooks/useSedeOrders.ts`)
- Sede-filtered order queries
- Create, update, cancel operations
- Real-time subscription support

**useRealtimeMetrics** (`src/hooks/useRealtimeMetrics.ts`)
- Real-time dashboard metrics
- Subscriptions to order/payment changes

**Other Useful Hooks**:
- `useSharedRealtime` - Shared subscription management to prevent duplicates
- `useSubstitutions` - Product substitution history
- `useDelivery` - Delivery person state
- `useExport` - CSV export functionality
- `usePerformance` - Performance monitoring

### Permissions System

The application uses a comprehensive role-based permission system defined in `usePermissions.ts`.

#### Role Mapping
Database roles are mapped to permission roles:
- `admin_global` → `admin` (full access)
- `admin_punto` → `administrador_punto` (sede-specific admin)
- `agent` → `agent` (limited read-only)

#### Permission Matrix

| Permission | admin | administrador_punto | agent |
|-----------|-------|---------------------|-------|
| View all sedes | ✓ | ✗ | ✗ |
| Create/edit/delete sedes | ✓ | ✗ | ✗ |
| Manage users | ✓ | ✓ (own sede) | ✗ |
| Assign users to other sedes | ✓ | ✗ | ✗ |
| Manage repartidores | ✓ | ✓ (own sede) | ✗ |
| Create/edit/delete products | ✓ | ✓ | ✗ |
| View all orders | ✓ | ✗ (own sede) | ✗ |
| Cancel orders | ✓ | ✓ | ✗ |
| Transfer orders | ✓ | ✗ | ✗ |
| View metrics | ✓ | ✓ (own sede) | ✗ |
| View/edit configurations | ✓ | ✓ | ✗ |

#### Resource Access Control
Use `canAccessResource(resourceSedeId)` to check if user can access a specific sede's resource:
```typescript
const { canAccessResource, isAdmin, userSedeId } = usePermissions();
if (!canAccessResource(order.sede_id)) {
  // Deny access
}
```

### Security Considerations

#### Authentication Security
- Passwords stored as bcrypt hashes in database
- Session tokens managed in memory (cleared on logout/refresh)
- Role-based access control enforced at component and API level
- No sensitive data in localStorage (only user metadata)

#### Database Security
- **RLS Status**: Row Level Security (RLS) is **DISABLED** on `profiles` table
  - This is intentional and safe because the app uses custom authentication (not Supabase Auth)
  - All security checks are handled in application layer via `customAuthService.canManageUsers()`
  - RLS policies that use `auth.uid()` don't work with nickname-based custom auth
  - Only admin_global and admin_punto roles can perform admin operations
- Sede-based data isolation for multi-tenant architecture
- Sensitive operations restricted by role permissions in code
- SQL injection protection via parameterized queries
- **Important**: Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code

## Development Patterns & Best Practices

### Service Layer Pattern

All services follow a consistent class-based singleton pattern:

```typescript
// Service definition
export class MyService {
  async getData(sedeId: string) {
    // Implementation
  }
}

// Export singleton instance
export const myService = new MyService();

// Usage in components
import { myService } from '@/services/myService';
const data = await myService.getData(sedeId);
```

### Async State Management Pattern

Always use `useAsyncState<T>()` for consistent async operations:

```typescript
import { useAsyncState } from '@/hooks/useAsyncState';

const { data, loading, error, execute } = useAsyncState<OrderType[]>();

useEffect(() => {
  execute(() => orderService.getOrders(sedeId));
}, [sedeId]);
```

### Logging Pattern

Use the centralized logger instead of console.log:

```typescript
import { logDebug, logInfo, logWarn, logError } from '@/utils/logger';

logDebug('ComponentName', 'Debug message', { contextData });
logInfo('Service', 'Operation completed');
logWarn('Auth', 'Token expiring soon');
logError('API', 'Request failed', error);
```

### Sede-Based Data Filtering Pattern

Always validate and filter by sede_id for multi-tenant isolation:

```typescript
// In services
if (!sedeId) {
  throw new Error('sede_id is required');
}

// Validate UUID format
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(sedeId)) {
  throw new Error('Invalid sede_id format');
}

// Apply filter
let query = supabase.from('table_name').select('*');
query = query.eq('sede_id', sedeId);
```

### Lazy Loading Pattern

Use lazy loading for heavy components to optimize bundle size:

```typescript
import { lazy, Suspense } from 'react';
import { Loading } from '@/components/Loading';

const AdminPanel = lazy(() =>
  import('@/components/AdminPanel').then(m => ({ default: m.AdminPanel }))
);

// In JSX
<Suspense fallback={<Loading />}>
  <AdminPanel />
</Suspense>
```

### Real-time Subscription Pattern

Use Supabase subscriptions for live data updates:

```typescript
useEffect(() => {
  const subscription = supabase
    .channel('table-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'ordenes' },
      (payload) => {
        // Handle update
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, []);
```

### Date/Timezone Handling Pattern

Always use Colombia timezone (UTC-5) for date operations:

```typescript
import { auditAndFixDateFilters } from '@/utils/timezoneAudit';

// Correct timezone handling
const filters = auditAndFixDateFilters({
  fechaInicio: startDate,
  fechaFin: endDate
});
```

### Permission Checking Pattern

Use `usePermissions` hook for role-based access control:

```typescript
const { permissions, canAccessResource, isAdmin } = usePermissions();

// Check specific permission
if (!permissions.canCreateProduct) {
  return <AccessDenied />;
}

// Check resource access
if (!canAccessResource(order.sede_id)) {
  return <AccessDenied />;
}

// Check role
if (!isAdmin) {
  return <RestrictedView />;
}
```

### Error Handling Pattern

Implement consistent error handling in all async operations:

```typescript
try {
  const result = await service.operation();
  // Handle success
} catch (error) {
  logError('Component', 'Operation failed', error);
  // Show user-friendly error message
  toast.error('Operation failed. Please try again.');
}
```

## Important File Locations

### Configuration
- `src/lib/supabase.ts` - Supabase client and TypeScript types
- `src/config/api.ts` - API configuration and table names
- `.env` - Environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

### Type Definitions
- `src/types/menu.ts` - Menu and product types
- `src/types/delivery.ts` - Delivery-related types
- `src/types/payment.ts` - Payment-related types

### Utilities
- `src/utils/logger.ts` - Centralized logging system
- `src/utils/dateUtils.ts` - Date formatting and timezone handling
- `src/utils/exportUtils.ts` - CSV export utilities
- `src/utils/timezoneAudit.ts` - Timezone validation and correction
- `src/utils/optimisticUpdates.ts` - Optimistic UI update helpers

### Contexts
- `src/contexts/InventoryContext.tsx` - Inventory state management
- `src/contexts/SedeContext.tsx` - Sede selection state

### SQL Scripts
Located in root directory and `_dev_scripts/`:
- `populate_sede_tables.sql` - Initialize sede-specific inventory
- `create_user_secure.sql` - User creation with password hashing
- `migrate_to_nickname_auth.sql` - Migration script for custom auth
- Various debug and verification scripts for development

## Common Troubleshooting

### Authentication Issues
- Check that `profiles` table has correct nickname and password_hash
- Verify sede_id is assigned to user
- Check localStorage for stale session data (clear if needed)
- Ensure role is one of: `admin_global`, `admin_punto`, `agent`

### User Deletion Not Working
- **Most likely cause**: RLS is enabled on `profiles` table
- **Solution**: Run `ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;` in Supabase SQL Editor
- **Why**: Custom auth doesn't work with `auth.uid()` based RLS policies
- **Verification**: Check console logs for "⚠️ ADVERTENCIA: El usuario todavía existe después de la eliminación!"
- **See**: `SOLUCION_DELETE_USER.md` for complete guide

### Sede Filtering Issues
- Validate sede_id is a valid UUID format
- Check that user's sede_id matches resource sede_id for non-admin users
- Verify sede-specific tables (`sede_platos`, etc.) have correct data

### Real-time Updates Not Working
- Check Supabase real-time is enabled for the table
- Verify subscription channel name is unique
- Ensure proper cleanup with `unsubscribe()` in useEffect return

### Performance Issues
- Check if heavy components are lazy loaded
- Verify React Query cache configuration (5min staleTime, 10min gcTime)
- Use `useAsyncState` to prevent redundant API calls
- Monitor with `PerformanceMonitor` component
