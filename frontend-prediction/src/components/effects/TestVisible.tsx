const TestVisible = () => {
  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '200px',
        height: '200px',
        backgroundColor: 'red',
        zIndex: 9999,
        opacity: 0.5,
        border: '5px solid yellow',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '24px',
        fontWeight: 'bold'
      }}
    >
      TEST
    </div>
  );
};

export default TestVisible;
