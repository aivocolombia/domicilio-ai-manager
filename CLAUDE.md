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
- `clientes` - Customer information
- `repartidores` - Delivery personnel
- `pagos` - Payment records

### Service Layer Architecture

#### MenuService (`src/services/menuService.ts`)
- CRUD operations for platos, bebidas, toppings
- Sede-specific availability management
- Timeout handling and error management
- Complex joins for dish-topping relationships

#### Authentication Flow
1. User login via `signIn()` in `useAuth.tsx:33-58` using nickname/password
2. Custom authentication service validates credentials against `profiles` table
3. Session stored locally with `customAuthService.ts`
4. Route protection in `ProtectedRoute.tsx` with role-based access
5. Role-based permissions throughout app via `usePermissions.ts`

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

### Security Considerations

#### Authentication Security
- Passwords stored as bcrypt hashes in database
- Session tokens managed in memory (cleared on logout/refresh)
- Role-based access control enforced at component and API level
- No sensitive data in localStorage (only user metadata)

#### Database Security
- Row Level Security (RLS) policies on Supabase tables
- Sede-based data isolation for multi-tenant architecture
- Sensitive operations restricted by role permissions
- SQL injection protection via parameterized queries
