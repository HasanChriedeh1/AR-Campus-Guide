import type { NavigationDestination } from './navigation'

export const DEMO_COORDINATE = { lat: 33.71314599891659, lng: 35.48279627287705 } as const

export const CAMPUS_DESTINATIONS = [
  { id: 'finance', label: 'Finance', description: 'Student accounts, tuition, and payments', imageSrc: '/finance.png', imageAlt: 'Entrance to the RHU Finance office', isDemoCoordinate: true, coordinate: DEMO_COORDINATE },
  { id: 'cafeteria', label: 'Cafeteria', description: 'Food, drinks, and student seating', imageSrc: '/Cafeteria.png', imageAlt: 'RHU cafeteria building and Campus Bites sign', isDemoCoordinate: true, coordinate: DEMO_COORDINATE },
  { id: 'block-c', label: 'Block C', description: 'Classrooms and computer labs', imageSrc: '/blockC.png', imageAlt: 'Exterior view of RHU Block C', isDemoCoordinate: true, coordinate: DEMO_COORDINATE },
  { id: 'library', label: 'Library', description: 'Study, research, and quiet spaces', imageSrc: '/Library.png', imageAlt: 'Arched entrance to the RHU Library', isDemoCoordinate: true, coordinate: DEMO_COORDINATE },
  { id: 'admissions', label: 'Admissions', description: 'Applications and prospective student support', imageSrc: '/admissions.png', imageAlt: 'Entrance and sign for the RHU Admissions Office', isDemoCoordinate: true, coordinate: DEMO_COORDINATE },
] satisfies NavigationDestination[]

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
