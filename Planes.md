# Planes de Suscripción SaaS: Estructura, Límites y Refactorización

Este documento detalla la estructura actual y propuesta de los niveles de suscripción de la plataforma SaaS BotaniQ. Se introduce el nuevo plan intermedio **Aura** entre **Esencia** y **Alquimia**, y se detalla el esquema de migración de base de datos e impacto en el código frontend.

---

## 📊 Matriz de Planes y Niveles

| Característica / Módulo | Nivel 1: Esencia (Básico) | Nivel 2: Aura (Intermedio) | Nivel 3: Alquimia (PRO) | Nivel 4: Edén (PREMIUM) |
| :--- | :---: | :---: | :---: | :---: |
| **Precio Estimado** | $400 MXN / mes | $650 MXN / mes | $900 MXN / mes | $1,300 MXN / mes |
| **Canal de Pedidos** | WhatsApp | WhatsApp | Pasarela de Pago + WhatsApp | Pasarela de Pago + WhatsApp |
| **Catálogo de Productos** | Máx. 40 productos / 3 var. | Sin límites | Sin límites | Sin límites |
| **Secciones UI (config_ui)** | Máx. 10 elementos / sección | Sin límites | Sin límites | Sin límites |
| **Sección Premium (Instagram)** | Bloqueado | **Desbloqueado** | Desbloqueado | Desbloqueado |
| **Gestión de Ayundantes/Equipo** | Bloqueado | Bloqueado | **Desbloqueado** (hasta 3) | Desbloqueado (ilimitado) |
| **Pasarelas de Pago** | Bloqueado | Bloqueado | **Stripe / OpenPay** | Stripe / OpenPay |
| **Logística y Repartidores** | Bloqueado | Bloqueado | Bloqueado | **App Repartidores + GPS** |
| **Dominio Personalizado** | Bloqueado | Bloqueado | Bloqueado | **Dominio propio (.com)** |

---

## 🔒 Auditoría de Limitaciones Existentes

Actualmente, el sistema implementa la seguridad y limitaciones de dos formas principales: en la base de datos (PostgreSQL triggers) y en el cliente (Feature Gates).

### 1. Restricciones en Base de Datos (Triggers SQL)
Ubicación: [enforce_saas_limits.sql](file:///c:/Users/User/Documents/BotaniQ/supabase/migrations/20260525000000_enforce_saas_limits.sql)
- **`check_product_limits()`**: Lanza excepción si la tienda tiene `subscription_level = 1` y ya cuenta con 40 o más productos.
- **`check_variant_limits()`**: Lanza excepción si la tienda tiene `subscription_level = 1` y el producto ya cuenta con 3 o más variantes.
- **`check_tienda_config_limits()`**: Lanza excepción al actualizar `config_ui` si el arreglo de servicios, testimonios, beneficios, galeria o flores excede los 10 elementos.
- **`tiendas_subscription_level_check`**: Restringe la columna `subscription_level` a `BETWEEN 0 AND 3`.

### 2. Restricciones en Frontend (React)
- **`FeatureGate`**: Utiliza el nivel de suscripción para ocultar o deshabilitar módulos completos (Equipo, Repartidores).
- **Editores de sección (`SectionListEditor.tsx`)**: Oculta el botón "Agregar" si el nivel de la tienda es `1` y se alcanzan los 10 elementos.
- **Configuración de Temas (`TemaTab.tsx`)**: Bloquea las secciones premium si el nivel de la tienda es menor a `2` (antiguo PRO, ahora requiere que siga en `< 2` para que Aura lo desbloquee).
- **Pasarela (`PagosTab.tsx`) y Checkout (`CartDrawer.jsx`)**: Habilita cobros con tarjeta solo si el nivel es `>= 2` (antiguo PRO, ahora debe pasar a `>= 3`).

---

## 🛠️ Plan de Migración de Base de Datos

Dado que los niveles de suscripción son números enteros incrementales, la introducción del plan **Aura** requiere desplazar los niveles superiores:
- **Nivel 1**: Esencia (Sin cambios)
- **Nivel 2**: Aura (Nuevo)
- **Nivel 3**: Alquimia (Desplazado desde 2)
- **Nivel 4**: Edén (Desplazado desde 3)

### Script de Migración SQL
Se debe crear un archivo de migración en Supabase (`supabase/migrations/20260616160000_add_aura_tier.sql`):

```sql
-- 1. Modificar el CHECK constraint para permitir el nivel 4 (Edén)
ALTER TABLE public.tiendas
  DROP CONSTRAINT IF EXISTS tiendas_subscription_level_check,
  ADD CONSTRAINT tiendas_subscription_level_check
    CHECK (subscription_level BETWEEN 0 AND 4);

-- 2. Desplazar los niveles existentes en orden descendente para evitar colisiones lógicas
-- Mover nivel 3 (Edén) a nivel 4
UPDATE public.tiendas
SET subscription_level = 4
WHERE subscription_level = 3;

-- Mover nivel 2 (Alquimia) a nivel 3
UPDATE public.tiendas
SET subscription_level = 3
WHERE subscription_level = 2;

-- 3. Actualizar la tabla suscripciones si se tienen registros históricos de planes
-- Opcional: Si los planes se guardan con texto en la tabla `suscripciones`
UPDATE public.suscripciones
SET plan = 'alquimia'
WHERE plan = 'pro';

UPDATE public.suscripciones
SET plan = 'eden'
WHERE plan = 'premium';

UPDATE public.suscripciones
SET plan = 'esencia'
WHERE plan = 'basico';
```

---

## 💻 Plan de Refactorización de Código

### 1. Actualizar el Enum del Cliente
En [types.ts](file:///c:/Users/User/Documents/BotaniQ/src/types.ts):
```diff
 export enum SubscriptionLevel {
   BLOCKED  = 0,
   BASICO   = 1,
+  AURA     = 2,
-  PRO      = 2,
+  PRO      = 3,
-  PREMIUM  = 3
+  PREMIUM  = 4
 }
```

### 2. Modificaciones en el Layout de Administración
En [AdminLayout.tsx](file:///c:/Users/User/Documents/BotaniQ/src/layouts/AdminLayout.tsx):
- Actualizar los límites de rutas protegidas:
  ```diff
-   if (item.to === '/admin/equipo' && (!isOwnerOrSuper || level < 2)) return false;
+   if (item.to === '/admin/equipo' && (!isOwnerOrSuper || level < 3)) return false;
-   if (item.to === '/admin/repartidores' && level < 3) return false;
+   if (item.to === '/admin/repartidores' && level < 4) return false;
  ```
- Actualizar la constante `PLANS` para incluir el plan **Aura** en la grilla de selección y precios:
  ```typescript
  // Agregar plan Aura en PLANS array
  {
    id: 'aura',
    levelLabel: 'Nivel 2',
    name: 'BotaniQ Aura',
    desc: 'Diseño libre sin límites de secciones, ideal para destacar tu marca.',
    prices: { mxn: '$650 MXN', usd: '$32 USD', eur: '32 €', gbp: '£28' },
    features: ['Sin límites en secciones de inicio', 'Feed de Instagram premium', 'Catálogo de flores ilimitado', 'Ventas vía WhatsApp'],
    buttonText: 'Activar Aura'
  }
  ```

### 3. Modificaciones en Pasarelas de Pago y Checkout
- En [PagosTab.tsx](file:///c:/Users/User/Documents/BotaniQ/src/pages/admin/components/config/PagosTab.tsx):
  ```diff
-  const hasStripeEnabled = tenant.subscription_level >= 2;
+  const hasStripeEnabled = tenant.subscription_level >= 3;
  ```
- En [CartDrawer.jsx](file:///c:/Users/User/Documents/BotaniQ/src/components/ui/CartDrawer.jsx):
  ```diff
-  const hasSubscriptionForCheckout = tenant.subscription_level >= 2;
+  const hasSubscriptionForCheckout = tenant.subscription_level >= 3;
  ```
- En [ProductoCard.jsx](file:///c:/Users/User/Documents/BotaniQ/src/components/ui/ProductoCard.jsx):
  ```diff
-  {(tenant?.preferred_gateway === 'whatsapp' || (tenant?.subscription_level ?? 0) < 2) ? (
+  {(tenant?.preferred_gateway === 'whatsapp' || (tenant?.subscription_level ?? 0) < 3) ? (
  ```
- En [ProductDetailPage.tsx](file:///c:/Users/User/Documents/BotaniQ/src/pages/public/ProductDetailPage.tsx):
  ```diff
-  const isEcommerce = (tenant.subscription_level ?? 1) >= 2;
+  const isEcommerce = (tenant.subscription_level ?? 1) >= 3;
  ```

### 4. Modificaciones en las Edge Functions
Para garantizar la integridad y evitar el bypass de cobros desde la API de Supabase, las Edge Functions deben auditar y validar el nuevo nivel `3` (Alquimia):
- En [create-checkout-session/index.ts](file:///c:/Users/User/Documents/BotaniQ/supabase/functions/create-checkout-session/index.ts):
  ```diff
-  if (tienda.subscription_level < 2) {
+  if (tienda.subscription_level < 3) {
  ```
- En [create-openpay-checkout/index.ts](file:///c:/Users/User/Documents/BotaniQ/supabase/functions/create-openpay-checkout/index.ts):
  ```diff
-  if (tienda.subscription_level < 2) {
+  if (tienda.subscription_level < 3) {
  ```
- En [stripe-webhook/index.ts](file:///c:/Users/User/Documents/BotaniQ/supabase/functions/stripe-webhook/index.ts):
  ```diff
-  const subLevel = plan === 'premium' ? 3 : (plan === 'pro' ? 2 : 1);
+  const subLevel = plan === 'premium' ? 4 : (plan === 'pro' ? 3 : (plan === 'aura' ? 2 : 1));
  ```
- En [create-saas-checkout/index.ts](file:///c:/Users/User/Documents/BotaniQ/supabase/functions/create-saas-checkout/index.ts):
  - Actualizar los payloads válidos y el mapeo de `PRICE_IDS`.
