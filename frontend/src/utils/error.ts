import axios from 'axios';

/**
 * Extracts a human-readable error message from any error value.
 * Handles Axios errors, plain Errors, and unknown values safely.
 */
export const getErrorMessage = (err: unknown): string => {
  if (axios.isAxiosError(err)) {
    // Server returned a JSON error body with a message field
    const serverMsg = err.response?.data?.message as string | undefined;
    return serverMsg ?? err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'An unexpected error occurred';
};
