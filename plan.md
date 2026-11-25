# ARAN – MASTER APPLICATION DEVELOPMENT PROMPT
## Premium Food Ordering, Delivery & PWA Platform

**Project:** ARAN  
**Product:** Online Food Ordering & Delivery Platform  
**Version:** 1.0  
**Architecture:** MERN Stack – Modular Monolith  
**Frontend:** React.js + Vite  
**Backend:** Node.js + Express.js  
**Database:** MongoDB + Mongoose  
**Language:** JavaScript only  
**Platform:** Responsive Website + Progressive Web App (PWA)

---

# 1. PROJECT OBJECTIVE

Build a complete, production-ready online food ordering platform for a premium food brand named **ARAN**.

This must be a fully functional commercial application, not a static website, UI prototype, or landing-page-only implementation.

The application must contain three major systems:

1. Customer-facing food ordering website.
2. Secure admin dashboard for complete business management.
3. Delivery and pickup order management system.

Customers must be able to browse products, check availability, add products to their cart, select home delivery or pickup, apply coupons, complete payments, and track their orders.

The admin must be able to manage the entire business through a centralized dashboard without modifying application code.

Build the architecture in a way that supports future expansion to multiple branches, delivery partners, loyalty programs, and POS integration.

**Development rules:**

- Use JavaScript throughout the entire application.
- Do not use TypeScript.
- Do not use Next.js.
- Do not create fake functionality.
- Do not use static dummy data as the permanent application data source.
- Connect all functional pages to real backend APIs.
- Use reusable components.
- Maintain clean, modular, maintainable code.
- Follow production-level coding practices.
- Never expose API secrets in frontend code.
- Do not leave major features as non-functional buttons.

# 2. BRAND IDENTITY AND DESIGN DIRECTION

## Brand identity

Brand name: ARAN

Brand positioning: Premium, modern, youthful, food-focused, visually appealing and trustworthy.

The website should communicate:

- Freshly prepared food.
- Quality ingredients.
- Premium food presentation.
- Easy online ordering.
- Reliable delivery.
- A memorable food experience.

Avoid generic food delivery website designs.

Create a distinct visual identity for ARAN.

## 2.1 Color system

Use a premium light theme.

Primary palette:

| Color | Hex | Application |
|---|---|---|
| Warm Cream | #F7F2E9 | Main background |
| Pure White | #FFFFFF | Cards and surfaces |
| ARAN Orange | #E87535 | Primary brand accent |
| Deep Charcoal | #28231F | Primary text |
| Soft Beige | #E9DFD0 | Borders and secondary backgrounds |
| Muted Brown | #776B60 | Secondary text |
| Success Green | #477B53 | Availability and success |
| Error Red | #D94C45 | Errors and warnings |

Design rules:

- Use cream as the main page background.
- Use white for product cards and elevated surfaces.
- Use orange for primary actions.
- Use charcoal for headings and important text.
- Use subtle beige borders.
- Use green only for availability and successful states.
- Avoid excessive gradients.
- Avoid neon colors.
- Avoid unnecessary decorative colors.
- Maintain strong contrast and accessibility.

## 2.2 Typography

Use a consistent professional typography system.

**Primary heading font: Manrope**

Use for:
- Hero headings.
- Page titles.
- Section headings.
- Product headings.
- Dashboard headings.

**Body font: Inter**

Use for:
- Paragraphs.
- Product descriptions.
- Form labels.
- Navigation.
- Buttons.
- Tables.
- Dashboard data.

Typography scale:

| Element | Size |
|---|---|
| Hero heading | 56–72px desktop |
| Main page heading | 36–48px |
| Section heading | 26–32px |
| Product heading | 18–22px |
| Body text | 14–16px |
| Small labels | 12–13px |
| Buttons | 14–16px |

On mobile, scale headings appropriately. Avoid oversized text that creates unnecessary scrolling.

Use font weights:
- Regular: 400
- Medium: 500
- Semibold: 600
- Bold: 700
- Extra bold: 800

Use Google Fonts or self-hosted font files with appropriate fallback fonts.

## 2.3 UI design principles

Follow these principles throughout the application:

1. Clean visual hierarchy.
2. Premium editorial-style layouts.
3. Consistent spacing.
4. High-quality food photography.
5. Subtle shadows.
6. Rounded but not excessively rounded cards.
7. Minimal icons.
8. Clear call-to-action buttons.
9. Proper empty states.
10. Consistent loading states.
11. Smooth page transitions.
12. Mobile-first design.

Spacing should follow a consistent 4px-based system.

Suggested radius:

- Buttons: 10px.
- Input fields: 10px.
- Product cards: 16px.
- Large content sections: 20px.
- Modal dialogs: 18px.

# 3. ANIMATION AND INTERACTION SYSTEM

The application must feel smooth, responsive and premium.

Use **Framer Motion (Motion for React)** for animations.

Do not over-animate the application. Every animation should have a purpose.

## 3.1 Global animations

Implement:

- Smooth page transitions.
- Fade-in content.
- Slide-up section reveals.
- Smooth modal transitions.
- Button hover effects.
- Card hover effects.
- Navigation transitions.
- Loading skeletons.
- Toast notifications.
- Smooth accordion expansion.

Animation specifications:

| Interaction | Animation |
|---|---|
| Page transition | 200–300ms fade |
| Modal opening | 250ms fade + scale |
| Button hover | 150ms |
| Product card hover | 200ms |
| Dropdown | 180ms |
| Toast | 250ms slide |
| Section reveal | 450–650ms |
| Cart drawer | 300ms slide |
| Loading skeleton | Subtle shimmer |

Use natural easing curves.

## 3.2 Home page animations

- Hero text enters with a subtle staggered animation.
- Main food image fades and scales into view.
- CTA buttons animate on hover.
- Featured product cards reveal as the user scrolls.
- Category cards have subtle hover movement.
- Promotional banners have gentle transitions.
- Navigation background changes subtly when scrolling, if appropriate.

## 3.3 Product interactions

- Product image zoom on desktop hover.
- Smooth add-to-cart animation.
- Cart count updates with a small scale animation.
- Quantity selector has subtle transitions.
- Product modal opens smoothly.
- Added-to-cart confirmation appears as a toast.

## 3.4 Shopping cart animations

- Cart drawer slides in from the right.
- Product removal animates smoothly.
- Quantity changes update the totals.
- Coupon success displays a small confirmation animation.
- Checkout button has a clear loading state.

## 3.5 Admin dashboard animations

Keep admin animations more restrained.

- Sidebar expand and collapse.
- Dashboard card fade-in.
- Table row hover.
- Notification dropdown.
- Modal transitions.
- Order status update feedback.
- Chart loading transitions.

## 3.6 Animation performance

- Prefer transform and opacity.
- Avoid heavy animations on every element.
- Avoid scroll-jacking.
- Avoid unnecessary parallax.
- Support prefers-reduced-motion.
- Ensure animations do not block interactions.
- Keep mobile performance smooth.

# 4. CUSTOMER-FACING WEBSITE

Create the following complete customer application.

## 4.1 Header and navigation

Desktop header:

- ARAN logo.
- Home.
- Menu.
- Our Story.
- Offers.
- Contact.
- Search icon.
- Account icon.
- Cart icon with item count.

Header requirements:

- Sticky navigation.
- Transparent or minimal initial appearance.
- White/cream surface when scrolled.
- Subtle shadow when appropriate.
- Active navigation state.
- Smooth hover transitions.

Mobile navigation:

- Compact ARAN logo.
- Search button.
- Cart button.
- Hamburger menu.
- Slide-in navigation drawer.
- Large touch targets.
- Easy access to cart.

## 4.2 Home page

Route: `/`

Create a premium food brand homepage.

### Section 1 – Hero

Use a large editorial-style hero layout.

Left side:
- Small brand label.
- Large heading.
- Short brand description.
- Explore Menu button.
- Order Now button.

Right side:
- Large, high-quality food image.
- Attractive composition.
- Soft cream background.
- Subtle decorative elements.

Use the following sample headline:

"Good Food. Great Moments."

Supporting copy:

"Discover your next favourite bite with ARAN. Fresh flavours, thoughtfully prepared and delivered to your door."

Buttons:
- Explore Menu
- Order Now

Do not use generic stock illustrations.

### Section 2 – Brand highlights

Create three or four highlights:

- Freshly Prepared.
- Quality Ingredients.
- Carefully Packed.
- Easy Ordering.

Use minimal icons.

### Section 3 – Categories

Create attractive category cards.

Categories must be dynamically fetched from MongoDB.

Each category card should have:
- Category image.
- Category name.
- Short description.
- Click navigation to filtered menu.

### Section 4 – Featured products

Display products marked as featured by the admin.

Product card details:
- Product image.
- Product name.
- Short description.
- Price.
- Food type.
- Availability.
- Add button.
- Wishlist button if enabled.

### Section 5 – Best sellers

Show popular products based on completed order history.

### Section 6 – Promotional banner

Create an attractive promotional section.

Example:

"Something Delicious Is Waiting."

CTA: Explore Our Menu.

Promotional content must be configurable through admin settings.

### Section 7 – Brand story

Introduce ARAN with a short brand description.

CTA: Discover Our Story.

### Section 8 – Customer reviews

Display approved reviews.

### Section 9 – Newsletter or offers subscription

Allow customers to subscribe to promotional updates with proper consent.

### Section 10 – Footer

Include:
- ARAN logo.
- Brand description.
- Menu links.
- Customer support.
- Contact information.
- Social media.
- Terms.
- Privacy policy.
- Refund policy.
- Copyright.

# 5. MENU AND PRODUCT MANAGEMENT EXPERIENCE

## 5.1 Menu page

Route: `/menu`

Features:

- Dynamic category filtering.
- Product search.
- Price filtering.
- Veg/non-veg filtering.
- Featured product filter.
- Best-selling products.
- Sort by price.
- Sort by popularity.
- Availability indicators.
- Responsive product grid.

Use URL query parameters for shareable filters where appropriate.

## 5.2 Product cards

Each card must contain:

- Product image.
- Product name.
- Description.
- Price.
- Optional original price.
- Food category.
- Veg/non-veg label.
- Bestseller badge where applicable.
- Availability status.
- Add to Cart button.

Use consistent card heights and image ratios.

## 5.3 Product details page

Route: `/product/:slug`

Include:

- Large product image gallery.
- Product name.
- Description.
- Price.
- Ingredients.
- Allergens.
- Portion size.
- Food type.
- Preparation time.
- Quantity selection.
- Customization options.
- Add to Cart.
- Related products.

Display clear allergen information when provided by the admin.

Do not invent ingredient or allergen claims.

# 6. CUSTOMER AUTHENTICATION AND ACCOUNT

Implement:

- Customer registration.
- Login.
- Logout.
- Forgot password.
- Password reset.
- Profile management.
- Phone number.
- Email.
- Address management.
- Order history.
- Order details.
- Wishlist.
- Review history.

Authentication requirements:

- Secure password hashing.
- Short-lived access tokens.
- Refresh token rotation.
- Secure cookie handling.
- Login validation.
- Rate limiting.
- Account activation.
- Authorization middleware.

Do not store passwords or sensitive authentication tokens in plain text.

Support guest checkout with verified contact details if enabled by the owner. Do not force registration unnecessarily.

# 7. CART MANAGEMENT

Route: `/cart`

Cart functionality:

- Add products.
- Remove products.
- Increase quantity.
- Decrease quantity.
- Display selected options.
- Calculate subtotal.
- Apply coupon.
- Remove coupon.
- Calculate delivery charges.
- Display final total.

Important business rules:

- Revalidate prices with the backend.
- Revalidate product availability.
- Prevent orders for unavailable items.
- Prevent negative quantities.
- Check minimum order value.
- Validate coupon eligibility.
- Never trust frontend-calculated totals.

Persist cart contents across sessions for authenticated customers where appropriate.

For guest users, use local storage with safe synchronization when they log in.

# 8. CHECKOUT AND ORDER PLACEMENT

Route: `/checkout`

Create a simple, premium and easy checkout experience.

## Step 1 – Fulfillment selection

Provide two options:

1. Home Delivery.
2. Pickup from ARAN.

For delivery:
- Select saved address.
- Add new address.
- Enter landmark.
- Enter delivery instructions.
- Validate local delivery availability.

For pickup:
- Display stall address.
- Display estimated preparation time.
- Display available pickup slots.

## Step 2 – Customer information

Fields:
- Full name.
- Mobile number.
- Email (optional if not required for a particular payment workflow).

## Step 3 – Order details

Display:
- Product list.
- Quantity.
- Price.
- Selected customizations.
- Subtotal.

## Step 4 – Coupon

Allow customers to enter promotional codes.

## Step 5 – Payment method

Provide:
- Online payment.
- Cash on delivery.

Online payment should support available Razorpay payment methods such as UPI, cards and net banking.

## Step 6 – Final confirmation

Display:
- Item subtotal.
- Discount.
- Tax if applicable.
- Delivery charge.
- Total amount.
- Fulfillment type.
- Delivery/pickup information.
- Payment method.

Add a prominent Place Order button.

Implement a secure backend checkout process with idempotency to prevent duplicate orders.

# 9. PAYMENT INTEGRATION

Integrate Razorpay.

Payment requirements:

1. Backend creates a Razorpay order.
2. Frontend opens Razorpay Checkout.
3. Customer completes payment.
4. Frontend submits payment response for verification.
5. Backend verifies the Razorpay signature.
6. Razorpay webhook provides authoritative payment events.
7. Payment records are updated idempotently.
8. Order status is updated based on verified payment.

Handle:
- Successful payments.
- Failed payments.
- Cancelled checkout.
- Duplicate callbacks.
- Duplicate webhooks.
- Payment timeouts.
- Refunds.
- Payment reconciliation.

Never expose the Razorpay secret key.

COD requirements:

- Create an unpaid order.
- Track cash collection.
- Allow authorized staff to record payment received.
- Maintain collection history.
- Support delivery and pickup collection.

# 10. ORDER TRACKING

Route: `/orders/:orderId`

Create an attractive order tracking page.

Order statuses:

1. Placed.
2. Confirmed.
3. Preparing.
4. Ready.
5. Out for delivery.
6. Delivered.

For pickup:
- Placed.
- Confirmed.
- Preparing.
- Ready.
- Picked Up.

For cancelled orders, show a separate cancellation state.

Show:
- Order number.
- Order date.
- Ordered products.
- Total amount.
- Payment status.
- Fulfillment type.
- Current status.
- Status history.
- Expected pickup or delivery information.
- Support contact.

Use Socket.IO for real-time status updates, with polling or refresh fallback.

Do not show fake GPS tracking. Live location tracking should only be implemented when a real delivery partner location source exists.

# 11. ADMIN DASHBOARD

Build a professional admin management application.

Route prefix: `/admin`

Use a clean dashboard layout with:

- Sidebar.
- Header.
- Page title.
- Breadcrumbs.
- Notification area.
- User profile.
- Main content.
- Responsive navigation.

## 11.1 Admin dashboard overview

Display:

- Today's revenue.
- Total orders.
- Pending orders.
- Confirmed orders.
- Completed orders.
- Cancelled orders.
- Average order value.
- Popular products.
- Low-stock items.
- Revenue chart.
- Order trend chart.
- Recent orders.

Use real MongoDB data.

Provide filters:
- Today.
- Yesterday.
- Last 7 days.
- Last 30 days.
- Custom date range.

## 11.2 Order management

Route: `/admin/orders`

Features:
- View all orders.
- Search by order number.
- Filter by status.
- Filter by payment method.
- Filter by delivery/pickup.
- Filter by date.
- View order details.
- Accept orders.
- Reject/cancel with reason.
- Update preparation status.
- Assign delivery personnel.
- Mark orders delivered.
- Mark pickup completed.
- View payment status.
- Print order receipt.

New orders should be visibly highlighted.

Provide optional audible new-order alerts, with admin control over sound settings.

Implement valid order-state transitions on the backend.

## 11.3 Product management

Route: `/admin/products`

Features:
- Add product.
- Edit product.
- Archive product.
- Upload images.
- Manage product price.
- Manage category.
- Set product availability.
- Set preparation time.
- Set ingredients.
- Set allergens.
- Set portion size.
- Set featured status.
- Set stock tracking.
- Configure product customization.

Use Cloudinary for product image uploads.

Implement image preview, upload progress and validation.

Do not permanently delete products referenced by historical orders.

## 11.4 Category management

Route: `/admin/categories`

Features:
- Create categories.
- Edit categories.
- Upload category images.
- Change category order.
- Activate/deactivate categories.

## 11.5 Inventory management

Route: `/admin/inventory`

Features:
- View stock.
- Add stock.
- Reduce stock.
- Set low-stock threshold.
- Track stock movement.
- View stock history.
- Temporarily disable unavailable products.

Prevent overselling.

Use transactional stock reservation where possible.

Define when stock is reserved, released and deducted.

## 11.6 Customer management

Route: `/admin/customers`

Features:
- Customer list.
- Search customers.
- Contact details.
- Order history.
- Total spending.
- Number of orders.
- Account status.
- Customer support history where available.

Protect personal customer information with appropriate access restrictions.

## 11.7 Delivery management

Route: `/admin/delivery`

Features:
- Delivery order list.
- Delivery assignment.
- Delivery personnel details.
- Customer address.
- Contact information.
- Order preparation status.
- Delivery status.
- Delivery history.

For Version 1, allow manual delivery assignment by the owner or manager.

## 11.8 Pickup management

Route: `/admin/pickup`

Features:
- Pickup orders.
- Scheduled pickup time.
- Preparation status.
- Ready-for-pickup notifications.
- Pickup completion.
- Collection/payment status.

## 11.9 Coupon management

Route: `/admin/coupons`

Features:
- Create coupon.
- Discount type.
- Percentage discount.
- Fixed discount.
- Minimum order.
- Maximum discount.
- Start date.
- Expiry date.
- Usage limit.
- Per-customer usage limit.
- Active/inactive status.

All coupon calculations must happen on the backend.

## 11.10 Reports and analytics

Route: `/admin/reports`

Reports:
- Daily sales.
- Weekly sales.
- Monthly sales.
- Order volume.
- Product performance.
- Best sellers.
- Payment breakdown.
- Delivery versus pickup.
- Cancellation statistics.
- Average order value.

Provide CSV export.

Clearly distinguish gross order value, discounts, refunds and net collected revenue.

## 11.11 Business settings

Route: `/admin/settings`

Create settings for:

**Brand**
- Brand name.
- Logo.
- Website contact details.
- Social links.

**Stall information**
- Stall address.
- Latitude and longitude.
- Contact number.

**Business timings**
- Opening time.
- Closing time.
- Weekly holidays.
- Temporary closure.
- Accepting orders toggle.

**Delivery**
- Delivery radius.
- Delivery fee.
- Minimum order.
- Free delivery threshold.
- Serviceable PIN codes.

**Pickup**
- Pickup address.
- Preparation time.
- Pickup slots.

**Notifications**
- New order alerts.
- Customer updates.
- Email settings.
- WhatsApp settings.

# 12. DATABASE DESIGN

Use MongoDB with Mongoose.

Create separate model files for:

1. User.
2. Product.
3. Category.
4. Address.
5. Order.
6. Payment.
7. Inventory.
8. InventoryTransaction.
9. Coupon.
10. Review.
11. DeliveryPartner.
12. Notification.
13. BusinessSettings.
14. RefreshToken or session records.

## Important schema requirements

### User

Fields:
- name.
- email.
- phone.
- passwordHash.
- role.
- isActive.
- isPhoneVerified.
- timestamps.

Roles:
- customer.
- owner.
- manager.
- staff.

### Product

Fields:
- name.
- slug.
- description.
- categoryId.
- images.
- pricePaise.
- compareAtPricePaise.
- foodType.
- ingredients.
- allergens.
- portionSize.
- preparationTime.
- isAvailable.
- isFeatured.
- stockManaged.
- timestamps.

### Order

Fields:
- orderNumber.
- userId.
- items.
- orderType.
- deliveryAddressSnapshot.
- pickupDetailsSnapshot.
- pricingSnapshot.
- paymentMethod.
- paymentStatus.
- orderStatus.
- deliveryPartnerId.
- scheduledFor.
- cancellationReason.
- statusHistory.
- timestamps.

### Payment

Fields:
- orderId.
- userId.
- provider.
- providerOrderId.
- providerPaymentId.
- amountPaise.
- currency.
- status.
- signatureVerified.
- webhookEventId.
- timestamps.

### Inventory

Fields:
- productId.
- availableQuantity.
- reservedQuantity.
- lowStockThreshold.
- isAvailable.
- updatedAt.

Use integer paise for monetary calculations.

Store product and price snapshots inside historical orders.

Create proper indexes.

Use MongoDB transactions where supported and appropriate for order creation, inventory reservation and payment-related operations.

# 13. BACKEND ARCHITECTURE

Use Node.js and Express.js.

Build a modular backend.

Suggested structure:

backend/
  src/
    config/
    models/
    routes/
    controllers/
    services/
    middleware/
    validators/
    utils/
    modules/
    integrations/
    jobs/
    sockets/
    app.js
    server.js

Use REST API versioning:

`/api/v1`

Implement:
- Authentication middleware.
- Role and permission middleware.
- Request validation.
- Central error handling.
- Structured logging.
- Rate limiting.
- CORS configuration.
- Secure HTTP headers.
- Request sanitization.
- API response consistency.

Use Zod or Joi for validation.

Use Swagger/OpenAPI documentation for APIs.

Never put core business logic inside route files.

# 14. FRONTEND ARCHITECTURE

Use React.js with Vite.

Use:
- React Router.
- Redux Toolkit.
- Axios.
- Tailwind CSS.
- Framer Motion / Motion.
- Lucide React icons.
- React Hook Form.
- Zod validation.

Suggested structure:

frontend/
  public/
    icons/
    images/
    manifest.webmanifest

  src/
    assets/
    components/
      common/
      layout/
      navigation/
      products/
      cart/
      checkout/
      admin/

    pages/
      customer/
      auth/
      account/
      orders/
      admin/
      legal/

    features/
      auth/
      products/
      cart/
      orders/
      payments/
      inventory/

    hooks/
    services/
    store/
    routes/
    utils/
    constants/
    styles/

    App.jsx
    main.jsx

Separate customer and admin layouts.

Use reusable API services.

Create reusable form controls, cards, tables, modals, loaders and notifications.

Use proper error boundaries.

Implement loading, empty, error and success states on every major data-driven page.

# 15. PWA IMPLEMENTATION

Build an installable Progressive Web App.

Use `vite-plugin-pwa`.

Features:
- Web app manifest.
- ARAN icons.
- App name and short name.
- Theme color.
- Background color.
- Standalone display mode.
- Service worker.
- Install prompt.
- Update notification.
- Offline fallback page.
- Cached public menu content.
- Responsive mobile experience.

Caching requirements:

- Cache static assets.
- Cache public product images.
- Cache public menu responses with sensible expiry.
- Do not cache payment information.
- Do not cache private user information in shared caches.
- Do not automatically replay checkout requests offline.
- Ensure users can refresh to the latest application version.

Push notifications should use a properly configured Web Push or Firebase Cloud Messaging integration.

Request notification permission only after the customer understands the benefit.

# 16. LOCAL DELIVERY VALIDATION

The initial business operates within a local delivery radius.

Admin must configure:

- Stall latitude.
- Stall longitude.
- Delivery radius.
- Delivery charge.
- Minimum order value.
- Free delivery threshold.
- Serviceable PIN codes.
- Opening hours.

Use location validation on the backend.

Allow customers to enter an address manually.

Do not require browser GPS permission to browse the website.

If the delivery location is outside the service area:
- Display a clear message.
- Offer pickup if available.
- Prevent delivery checkout.

# 17. NOTIFICATION SYSTEM

Implement a centralized notification service.

Channels:
- In-app.
- Web push.
- Email where configured.
- WhatsApp Business integration where configured.

Customer notifications:

- Order received.
- Payment successful.
- Order accepted.
- Food preparation started.
- Ready for pickup.
- Out for delivery.
- Delivered.
- Cancelled.
- Refund update.

Admin notifications:

- New order.
- Failed payment.
- Low inventory.
- Order cancellation.
- Customer issue.

Notifications must be generated from verified backend events, not solely from frontend interactions.

# 18. RESPONSIVE DESIGN REQUIREMENTS

The application must be fully responsive.

Test at:

- 320px.
- 375px.
- 390px.
- 430px.
- 768px.
- 1024px.
- 1280px.
- 1440px.
- 1920px.

Mobile requirements:

- No horizontal overflow.
- Easy thumb navigation.
- Sticky cart access.
- Proper image scaling.
- Responsive typography.
- Readable checkout forms.
- Large touch targets.
- Compact navigation.
- Smooth product interactions.

Tablet requirements:

- Two-column menu layout.
- Collapsible navigation.
- Responsive admin tables.
- Proper dashboard cards.

Desktop requirements:

- Three/four-column product grid.
- Full navigation.
- Sidebar admin dashboard.
- Wide content containers.
- Consistent alignment.

Use CSS Grid and Flexbox.

Do not create separate mobile and desktop applications.

# 19. SECURITY REQUIREMENTS

Implement production-level security.

- Hash passwords with bcrypt.
- Secure session handling.
- Access and refresh token management.
- Role-based authorization.
- API rate limiting.
- Input validation.
- Secure cookies.
- CSRF protection where applicable.
- CORS restrictions.
- Helmet security headers.
- File upload validation.
- Payment signature verification.
- Webhook signature verification.
- Database access restrictions.
- Environment variable management.
- Audit trail for important admin actions.

Do not store card information.

Do not trust client-side prices, discounts or stock.

Never allow customers to access admin APIs.

# 20. PERFORMANCE REQUIREMENTS

Optimize for mobile-first usage.

- Lazy-load images.
- Use WebP or AVIF where supported.
- Use responsive image sizes.
- Compress product images.
- Code-split routes.
- Lazy-load admin modules.
- Minimize unnecessary rerenders.
- Use pagination.
- Add database indexes.
- Avoid unnecessary API requests.
- Use caching where appropriate.
- Use efficient Socket.IO subscriptions.
- Monitor API response times.

Target good Core Web Vitals.

Aim for:
- LCP below 2.5 seconds.
- INP below 200 milliseconds.
- CLS below 0.1.

Measure actual performance using Lighthouse rather than claiming targets are achieved without testing.

# 21. TESTING REQUIREMENTS

Frontend:
- Vitest.
- React Testing Library.
- Playwright.

Backend:
- Jest or Vitest.
- Supertest.
- API integration tests.

Test the following end-to-end scenarios:

1. Customer registration.
2. Customer login.
3. Product browsing.
4. Product search.
5. Add to cart.
6. Quantity update.
7. Coupon application.
8. Delivery validation.
9. Pickup selection.
10. Successful online payment.
11. Failed online payment.
12. COD order.
13. Admin order acceptance.
14. Inventory update.
15. Order cancellation.
16. Refund workflow.
17. Customer order tracking.
18. PWA installation.
19. Mobile responsiveness.
20. Unauthorized admin access.

Include test cases for duplicate payment callbacks, duplicate webhooks and simultaneous orders for the same limited stock.

# 22. DEPLOYMENT

Suggested production deployment:

- Frontend: Vercel.
- Backend: Render or Railway.
- Database: MongoDB Atlas.
- Images: Cloudinary.
- DNS and security: Cloudflare.
- Payments: Razorpay.

Suggested domain architecture:

- aran.com – Customer website.
- admin.aran.com – Admin dashboard.
- api.aran.com – Backend API.

Configure:
- HTTPS.
- Production environment variables.
- Database backups.
- Error monitoring.
- Server logs.
- Uptime monitoring.
- Deployment rollback.
- Automated tests before deployment.

# 23. FUTURE EXPANSION

Keep the architecture ready for:

- ARAN loyalty rewards.
- Referral program.
- Delivery partner application.
- Live delivery tracking.
- POS integration.
- Multiple branches.
- Advanced analytics.
- Subscription food plans.
- Customer segmentation.
- Personalized recommendations.

Do not implement these future features prematurely.

# 24. DEVELOPMENT EXECUTION INSTRUCTIONS

You must build this application in controlled phases.

Do not attempt to generate the entire application in one massive code dump.

Follow this execution sequence:

## Phase 1 – Project foundation

- Initialize frontend and backend.
- Configure all dependencies.
- Establish folder structure.
- Create design system.
- Configure MongoDB.
- Configure environment variables.
- Configure routes.
- Configure global error handling.

## Phase 2 – Customer UI

- Build the complete homepage.
- Build navigation.
- Build category sections.
- Build menu.
- Build product cards.
- Build product details.
- Build cart.
- Build checkout UI.
- Build responsive layouts.
- Implement animations.

## Phase 3 – Backend

- Create database schemas.
- Implement authentication.
- Implement product APIs.
- Implement category APIs.
- Implement address management.
- Implement delivery validation.
- Implement cart validation.
- Implement order creation.

## Phase 4 – Admin dashboard

- Implement role-based authentication.
- Build dashboard.
- Build product management.
- Build order management.
- Build inventory.
- Build customer management.
- Build reports.
- Build settings.

## Phase 5 – Business integrations

- Integrate Razorpay.
- Integrate Cloudinary.
- Integrate Socket.IO.
- Integrate notifications.
- Implement delivery and pickup workflows.
- Implement COD.
- Implement refund handling.

## Phase 6 – PWA and production

- Configure PWA.
- Add app icons.
- Implement caching.
- Implement installation experience.
- Test all devices.
- Run security checks.
- Run end-to-end tests.
- Deploy.

# 25. STRICT CODING AGENT RULES

Follow these rules throughout development:

1. Before coding, inspect the existing project and understand its structure.
2. If no project exists, initialize it cleanly.
3. Do not overwrite existing working code unnecessarily.
4. Use JavaScript only.
5. Do not introduce TypeScript.
6. Do not introduce Next.js.
7. Do not use unnecessary dependencies.
8. Use reusable React components.
9. Maintain consistent naming conventions.
10. Write clean and readable code.
11. Keep frontend and backend responsibilities separate.
12. Use environment variables.
13. Never hardcode secrets.
14. Implement proper error handling.
15. Validate every important form.
16. Use real backend data.
17. Do not use fake payment success.
18. Do not use fake order tracking.
19. Do not leave buttons without actions.
20. Do not skip mobile responsiveness.
21. Do not ignore loading and error states.
22. Maintain database consistency.
23. Protect admin functionality.
24. Add meaningful comments only where necessary.
25. Test each completed feature before proceeding.

After completing each phase:

- Summarize completed work.
- List files created or modified.
- Explain implemented functionality.
- Report remaining tasks.
- Run relevant tests.
- Fix errors before moving to the next phase.

If an external service requires API credentials, build the integration properly and clearly identify the credentials needed. Never pretend an unconfigured integration is working.

If information is missing, use sensible configurable defaults instead of inventing business details.

# 26. FINAL ACCEPTANCE CRITERIA

The project is considered complete only when all of the following work:

**Customer application**
- Premium ARAN homepage.
- Complete food menu.
- Product details.
- Search and filters.
- Cart.
- Delivery checkout.
- Pickup checkout.
- Online payment.
- COD.
- Customer account.
- Order tracking.
- Order history.

**Admin application**
- Secure login.
- Dashboard analytics.
- Product management.
- Category management.
- Order management.
- Inventory.
- Customer management.
- Delivery assignment.
- Pickup management.
- Coupon management.
- Reports.
- Business settings.

**Technical application**
- Backend APIs.
- MongoDB database.
- Authentication and RBAC.
- Razorpay verification.
- Cloudinary integration.
- Real-time updates.
- PWA installation.
- Responsive design.
- Security testing.
- End-to-end testing.
- Production deployment.

**Design quality**
- Premium light theme.
- Consistent ARAN branding.
- Professional typography.
- High-quality food photography.
- Smooth animations.
- Responsive layouts.
- Accessible interactions.
- No broken or overflowing layouts.

---

# FINAL INSTRUCTION

Act as a senior full-stack engineer, UI/UX designer, database architect and QA engineer.

Build ARAN as a complete, professional, production-ready food ordering business platform.

Prioritize the customer experience, operational reliability, clean architecture, payment security and visual quality.

The result must look like a professionally designed food commerce product that customers would trust and enjoy using.

Do not stop after creating the homepage.

Do not stop after creating the frontend.

Complete the customer application, backend, database, admin dashboard, ordering workflows, payment integration, PWA and testing.

**Start with Phase 1. Inspect the existing environment, prepare the project architecture, establish the ARAN design system, and then proceed phase by phase.**

At every stage, ensure that the implementation is functional, tested, responsive and consistent with the ARAN brand identity.

**PROJECT NAME: ARAN – PREMIUM FOOD ORDERING & DELIVERY PLATFORM.**