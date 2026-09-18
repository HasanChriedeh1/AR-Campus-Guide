import type { NavigationDestination } from './navigation'

export const CAMPUS_DESTINATIONS = [
  { id: 'finance', label: 'Finance', description: 'Student accounts, tuition, and payments', imageSrc: '/images/destinations/finance-720.webp', imageSrcSet: '/images/destinations/finance-480.webp 480w, /images/destinations/finance-720.webp 720w', imageWidth: 720, imageHeight: 1280, imageAlt: 'Entrance to the RHU Finance office', isDemoCoordinate: false, coordinate: { lat: 33.71375, lng: 35.48433333333333 } },
  { id: 'cafeteria', label: 'Cafeteria', description: 'Food, drinks, and student seating', imageSrc: '/images/destinations/cafeteria-720.webp', imageSrcSet: '/images/destinations/cafeteria-480.webp 480w, /images/destinations/cafeteria-720.webp 720w', imageWidth: 720, imageHeight: 1280, imageAlt: 'RHU cafeteria building and Campus Bites sign', isDemoCoordinate: false, coordinate: { lat: 33.71349606857637, lng: 35.48392689194502 } },
  { id: 'block-c', label: 'Block C', description: 'Classrooms and computer labs', imageSrc: '/images/destinations/block-c-960.webp', imageSrcSet: '/images/destinations/block-c-480.webp 480w, /images/destinations/block-c-960.webp 960w', imageWidth: 960, imageHeight: 540, imageAlt: 'Exterior view of RHU Block C', isDemoCoordinate: false, coordinate: { lat: 33.71447222222222, lng: 35.48391666666667 } },
  { id: 'library', label: 'Library', description: 'Study, research, and quiet spaces', imageSrc: '/images/destinations/library-960.webp', imageSrcSet: '/images/destinations/library-480.webp 480w, /images/destinations/library-960.webp 960w', imageWidth: 960, imageHeight: 540, imageAlt: 'Arched entrance to the RHU Library', isDemoCoordinate: false, coordinate: { lat: 33.71377777777778, lng: 35.48425 } },
  { id: 'admissions', label: 'Admissions', description: 'Applications and prospective student support', imageSrc: '/images/destinations/admissions-720.webp', imageSrcSet: '/images/destinations/admissions-480.webp 480w, /images/destinations/admissions-720.webp 720w', imageWidth: 720, imageHeight: 1280, imageAlt: 'Entrance and sign for the RHU Admissions Office', isDemoCoordinate: false, coordinate: { lat: 33.71322673114103, lng: 35.48393880973027 } },
  { id: 'student-affairs', label: "Student's Affairs", description: 'Student services, support, and campus life', imageSrc: '/images/destinations/student-affairs-960.webp', imageSrcSet: '/images/destinations/student-affairs-480.webp 480w, /images/destinations/student-affairs-960.webp 960w', imageWidth: 960, imageHeight: 540, imageAlt: 'Entrance to the RHU Student Affairs office', isDemoCoordinate: false, coordinate: { lat: 33.71325, lng: 35.48386111111111 } },
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
