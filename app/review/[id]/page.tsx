import { requireAppUser } from '@/app/auth';
import Replay from './replay';
export const dynamic = 'force-dynamic';
export default async function ReplayPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  await requireAppUser(`/review/${id}`);
  return <Replay id={id} />;
}
