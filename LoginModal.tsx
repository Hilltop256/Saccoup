import React, { useState } from 'react';

const LoginModal = () => {
  const [photoSource, setPhotoSource] = useState('');

  const handleSourceSelection = (source) => {
    setPhotoSource(source);
  };

  const handlePhotoUpload = (event) => {
    // Handle photo upload logic based on the chosen source
    const file = event.target.files[0];
    // Add your upload logic here
  };

  return (
    <div>
      <h2>Upload Profile Picture</h2>
      <div>
        <button onClick={() => handleSourceSelection('camera')}>Use Camera</button>
        <button onClick={() => handleSourceSelection('gallery')}>Use Gallery</button>
      </div>
      {photoSource === 'camera' && (
        <input type="file" accept="image/*" capture="camera" onChange={handlePhotoUpload} />
      )}
      {photoSource === 'gallery' && (
        <input type="file" accept="image/*" onChange={handlePhotoUpload} />
      )}
    </div>
  );
};

export default LoginModal;