// PRESERVED: Form.io form renderer integration.
// Not currently active — isolated for potential future use.
import { Form } from '@formio/react';

export default function FormioRenderer({ schema, onSubmit }) {
  return (
    <Form
      form={schema}
      onSubmit={(submission) => onSubmit(submission.data)}
    />
  );
}
