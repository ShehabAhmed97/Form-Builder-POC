// PRESERVED: Form.io drag-and-drop builder integration.
// Not currently active — isolated for potential future use.
import { FormBuilder } from '@formio/react';

export default function FormioBuilder({ schema, onChange }) {
  return (
    <FormBuilder
      form={schema || { display: 'form', components: [] }}
      onChange={(newSchema) => onChange(newSchema)}
    />
  );
}
