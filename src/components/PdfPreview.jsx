import React from 'react';

const PdfPreview = React.memo(({ previewUrl }) => {
  console.log("Rendering PdfPreview component"); // Add this for debugging
  if (!previewUrl) {
    return null;
  }

  return (
    <div className="file-preview">
      <h4>Selected File Preview:</h4>
      <embed src={previewUrl} type="application/pdf" width="100%" height="400px" />
    </div>
  );
});

PdfPreview.displayName = 'PdfPreview'; // Optional: Helps in React DevTools

export default PdfPreview; 