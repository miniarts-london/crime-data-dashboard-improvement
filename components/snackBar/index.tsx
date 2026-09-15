import { Alert, Snackbar } from '@mui/material';

interface SnackBarProps {
  openSnackbar: boolean;
  message: string;
  handleCloseSnackbar?: () => void;
}

export default function SnackBar({ openSnackbar, message, handleCloseSnackbar }: SnackBarProps) {
  const onClose = (_event?: unknown, reason?: string) => {
    if (reason === 'clickaway') return;
    handleCloseSnackbar?.();
  };

  return (
    <Snackbar
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
      open={openSnackbar && Boolean(message)}
      onClose={onClose}
      autoHideDuration={8000}
    >
      <Alert onClose={onClose} severity="error" variant="filled" sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  );
}
