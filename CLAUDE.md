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

## Architecture Overview

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: shadcn/ui (Radix UI + Tailwind CSS)
- **Database**: Supabase (PostgreSQL)
- **State Management**: React Query + Context API
- **Authentication**: Supabase Auth
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
- `AdminPanel.tsx` - Administrator interface
- `Dashboard.tsx` - Main dashboard
- `Inventory.tsx` - Product/menu management
- `CallCenter.tsx` - Order management interface
- `DeliveryPersonnel.tsx` - Delivery staff management
- `StatusBar.tsx` - System status display

#### Authentication System
- `useAuth.tsx:1-204` - Authentication context and hooks
- Role-based access: `admin` and `agent` roles
- Profile management with automatic fallbacks
- Demo accounts: admin@ajiaco.com/admin123, agente@ajiaco.com/agente123

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
1. User login via `signIn()` in `useAuth.tsx:150-178`
2. Profile fetch with timeout/fallback in `useAuth.tsx:24-105`
3. Route protection in `ProtectedRoute.tsx:12-76`
4. Role-based access control throughout app

### Key Features

#### Multi-Sede Support
- Each user is assigned to a specific sede (location)
- Inventory management is sede-specific
- Products can have different availability/pricing per sede
- Fallback to base pricing if no sede-specific pricing exists

#### User Management
- Admin users can create user profiles via `AdminPanel`
- Users must manually register with Supabase Auth after profile creation
- Role-based permissions: admin (full access) vs agent (limited access)

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
- Admin role required for user management functions
- Agent role has limited access to inventory management only

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
2. Profile stored in `profiles` table without auth user
3. User registers manually with same email
4. System associates existing profile with new auth user

#### Order Processing
1. Orders created through `CallCenter` component
2. Assigned to delivery personnel via `DeliveryPersonnel`
3. Status tracking through order lifecycle
4. ETA management with update counting