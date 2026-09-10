'use client';
import { Flag } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel } from '@/components/ui/alert-dialog';

export default function ResignDialog({open,onOpenChange,onConfirm,busy=false,online=false}:{open:boolean;onOpenChange:(open:boolean)=>void;onConfirm:()=>void;busy?:boolean;online?:boolean}) {
  return <AlertDialog open={open} onOpenChange={value=>{if(!busy)onOpenChange(value);}}>
    <AlertDialogContent className="resign-dialog">
      <Flag className="resign-dialog-icon" aria-hidden="true" />
      <AlertDialogTitle>기권하시겠습니까?</AlertDialogTitle>
      <AlertDialogDescription>{online?'기권하면 패배로 기록되며, 대국을 되돌릴 수 없습니다. 확인하는 동안에도 대국 시간은 흐릅니다.':'현재 차례의 진영이 패배하고 대국이 종료됩니다.'}</AlertDialogDescription>
      <div className="resign-dialog-actions"><AlertDialogCancel disabled={busy}>계속 두기</AlertDialogCancel><button className="resign-confirm" disabled={busy} onClick={onConfirm}>{busy?'처리 중…':'기권하기'}</button></div>
    </AlertDialogContent>
  </AlertDialog>;
}
