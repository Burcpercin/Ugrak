import { Redirect } from 'expo-router';

// Bilinmeyen bir adrese gelinirse başlangıca dön.
export default function NotFound() {
  return <Redirect href="/" />;
}
