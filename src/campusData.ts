import type { NavigationDestination } from './navigation'

export const CAMPUS_DESTINATIONS = [
  { id: 'block-c', label: 'Block C', description: 'Classrooms and computer labs', coordinate: { lat: 33.713350, lng: 35.482550 } },
  { id: 'block-i', label: 'Block I', description: 'Student services and facilities', coordinate: { lat: 33.712960, lng: 35.482550 } },
  { id: 'library', label: 'Library', description: 'Study, research, and quiet spaces', coordinate: { lat: 33.713260, lng: 35.482700 } },
  { id: 'cafeteria', label: 'Cafeteria', description: 'Food, drinks, and student seating', coordinate: { lat: 33.713100, lng: 35.482900 } },
] satisfies Array<NavigationDestination & { description: string }>

export type MenuCategory = 'Breakfast' | 'Mains' | 'Snacks' | 'Drinks'

export const CAFETERIA_MENU = [
  { id: 'labneh-wrap', name: 'Labneh & zaatar wrap', description: 'Labneh, zaatar, tomato, mint, and olives.', category: 'Breakfast', price: 3.5, featured: true },
  { id: 'shawarma-plate', name: 'Chicken shawarma plate', description: 'Seasoned chicken, rice, pickles, and garlic sauce.', category: 'Mains', price: 6.5 },
  { id: 'pasta-primavera', name: 'Pasta primavera', description: 'Pasta with seasonal vegetables and a light tomato sauce.', category: 'Mains', price: 5.5 },
  { id: 'lentil-soup', name: 'Lentil soup', description: 'Warm lentil soup served with toasted bread.', category: 'Mains', price: 3 },
  { id: 'fruit-cup', name: 'Fresh fruit cup', description: 'A chilled selection of seasonal fruit.', category: 'Snacks', price: 2.5 },
  { id: 'coffee', name: 'Coffee', description: 'Freshly brewed hot coffee.', category: 'Drinks', price: 1.5 },
  { id: 'water', name: 'Water', description: 'Chilled bottled water.', category: 'Drinks', price: 1 },
] satisfies Array<{ id: string; name: string; description: string; category: MenuCategory; price: number; featured?: boolean }>
