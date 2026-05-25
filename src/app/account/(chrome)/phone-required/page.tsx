import { PageHeader } from '@/components/admin/primitives';
import { PhoneRequiredForm } from '@/components/auth/PhoneRequiredForm';

export default function PhoneRequiredPage() {
  return (
    <>
      <PageHeader
        eyebrow="Account security"
        title="Verify your phone"
        subtitle="A verified phone number is required before using Souqna, so WhatsApp notifications can reach the store owner."
      />
      <PhoneRequiredForm />
    </>
  );
}
