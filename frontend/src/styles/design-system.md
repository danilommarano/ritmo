# Ritmo Design System

## Overview
The Ritmo design system is inspired by creative video editing tools with a vibrant, modern color palette that reflects creativity, energy, and professional video production.

## Color Palette

### Brand Colors
- **Ritmo Blue/Purple**: `ritmo-*` - Primary brand color inspired by professional video editing interfaces
- **Creative Purple**: `creative-*` - Secondary brand color for creative elements
- **Energy Orange**: `energy-*` - Accent color for call-to-actions and highlights
- **Success Green**: `success-*` - For positive feedback and success states
- **Electric Blue**: `electric-*` - For interactive elements and hover states

### Usage Guidelines

#### Primary Colors
```css
/* Primary - Ritmo brand purple/blue */
bg-ritmo-500, text-ritmo-600, border-ritmo-300

/* Secondary - Creative purple */
bg-creative-500, text-creative-600, border-creative-300

/* Accent - Electric blue */
bg-electric-500, text-electric-600, border-electric-300
```

#### Gradients
```css
/* Main brand gradient */
bg-ritmo-gradient

/* Creative gradient */
bg-creative-gradient

/* Energy gradient */
bg-energy-gradient

/* Hero gradient */
bg-hero-gradient
```

## Typography

### Font Families
- **Display**: Inter (headings, important text)
- **Body**: Inter (body text, UI elements)

### Font Sizes
- **Headings**: text-4xl, text-5xl, text-6xl
- **Body**: text-base, text-lg, text-xl
- **Small**: text-sm, text-xs

## Spacing

### Custom Spacing
- **18**: 4.5rem (72px)
- **88**: 22rem (352px)
- **128**: 32rem (512px)

## Border Radius

### Custom Radius
- **sm**: calc(var(--radius) - 4px)
- **md**: calc(var(--radius) - 2px)
- **lg**: var(--radius) - 0.75rem by default

## Animations

### Custom Animations
- **fade-in**: Smooth fade in with slight upward movement
- **slide-up**: Slide up from bottom
- **pulse-slow**: Slow pulsing effect (3s)
- **float**: Gentle floating animation (6s)

### Usage
```css
animate-fade-in
animate-slide-up
animate-pulse-slow
animate-float
```

## Components

### Buttons

#### Primary Button
```jsx
<button className="px-8 py-4 bg-ritmo-gradient text-white rounded-full hover:shadow-lg transition-all duration-300 transform hover:scale-105">
  Primary Action
</button>
```

#### Secondary Button
```jsx
<button className="px-8 py-4 border-2 border-ritmo-300 text-ritmo-700 rounded-full hover:bg-ritmo-50 transition-all duration-300">
  Secondary Action
</button>
```

#### Ghost Button
```jsx
<button className="px-8 py-4 text-gray-700 hover:text-ritmo-600 transition-colors">
  Ghost Action
</button>
```

### Cards

#### Feature Card
```jsx
<div className="bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
  {/* Card content */}
</div>
```

#### Gradient Card
```jsx
<div className="bg-gradient-to-br from-ritmo-500 to-creative-500 rounded-2xl p-6 text-white">
  {/* Card content */}
</div>
```

### Navigation

#### Main Navigation
```jsx
<nav className="px-6 py-4 bg-white/80 backdrop-blur-sm">
  {/* Navigation content */}
</nav>
```

## Layout

### Container
```jsx
<div className="max-w-7xl mx-auto px-6">
  {/* Content */}
</div>
```

### Grid Layouts
```jsx
{/* Feature grid */}
<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
  {/* Grid items */}
</div>

{/* Hero grid */}
<div className="grid lg:grid-cols-2 gap-12 items-center">
  {/* Grid items */}
</div>
```

## Best Practices

### Color Usage
1. Use `ritmo-*` colors for primary brand elements
2. Use `creative-*` colors for secondary brand elements
3. Use `energy-*` colors for call-to-actions
4. Use `electric-*` colors for interactive elements
5. Maintain good contrast ratios for accessibility

### Animation Usage
1. Use subtle animations for better UX
2. Prefer `transition-all duration-300` for smooth interactions
3. Use `transform hover:scale-105` for button hover effects
4. Apply `animate-fade-in` for content reveals

### Spacing
1. Use consistent spacing with Tailwind's spacing scale
2. Use custom spacing (18, 88, 128) for special layouts
3. Maintain visual hierarchy with proper spacing

### Typography
1. Use font-bold for headings and important text
2. Use appropriate text sizes for hierarchy
3. Maintain good line-height for readability

## Dark Mode Support

The design system includes dark mode variants for all colors. Toggle dark mode using the `dark` class on the root element.

```jsx
<html className="dark">
  {/* Dark mode content */}
</html>
```
