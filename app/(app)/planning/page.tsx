import { redirect } from 'next/navigation';

export default function PlanningRedirect() {
  redirect('/calendrier?tab=planning');
}
