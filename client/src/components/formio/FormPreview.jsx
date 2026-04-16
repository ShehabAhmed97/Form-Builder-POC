import { Form } from '@formio/react';

export default function FormPreview({ schema }) {
  if (!schema?.components?.length) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
        No fields to preview. Add some fields first.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-medium mb-4 text-gray-700">Form Preview</h3>
      <Form
        form={schema}
        onSubmit={(submission) => {
          alert('Preview submit:\n' + JSON.stringify(submission.data, null, 2));
        }}
      />
    </div>
  );
}
