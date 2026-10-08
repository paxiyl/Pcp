import { useMutation } from "@tanstack/react-query";

import { uploadImageMutationFn } from "@/lib/api";

/** Uploads a file and resolves to its hosted URL. */
export const useUploadImage = () => useMutation({ mutationFn: uploadImageMutationFn });
