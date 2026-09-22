import { redirect } from 'next/navigation';

// Tasks now live inside the Calendar page.
export default function TasksRedirect() {
  redirect('/calendar');
}
