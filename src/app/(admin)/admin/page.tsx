import { redirect } from 'next/navigation';

/**
 * У раздела нет своей главной: первое, за чем администратор сюда заходит, —
 * очередь подтверждений. Пустой экран-заглушка на её месте был бы лишним шагом.
 */
export default function AdminIndexPage(): never {
  redirect('/admin/queue');
}
