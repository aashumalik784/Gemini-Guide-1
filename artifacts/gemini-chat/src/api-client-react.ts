// Stub all Gemini API hooks - replace with real API later
export const useListGeminiConversations = () => ({ data: [], isLoading: false, error: null })
export const getListGeminiConversationsQueryKey = () => ['conversations']
export const useCreateGeminiConversation = () => ({ mutate: () => {}, mutateAsync: async () => ({}), isPending: false })
export const useGetGeminiConversation = () => ({ data: null, isLoading: false })
export const getGetGeminiConversationQueryKey = (id: string) => ['conversation', id]
export const useDeleteGeminiConversation = () => ({ mutate: () => {}, isPending: false })
export const useUpdateGeminiConversation = () => ({ mutate: () => {}, isPending: false })
export const useListGeminiModels = () => ({ data: [], isLoading: false })
export const useAutoTitleGeminiConversation = () => ({ mutate: () => {} })
export const useSendGeminiMessage = () => ({ mutate: () => {}, isPending: false })
export const useGetGeminiMessages = () => ({ data: [], isLoading: false })
export const useGenerateGeminiImage = () => ({ mutate: () => {}, mutateAsync: async () => ({}), isPending: false })
export const useGenerateGeminiVideo = () => ({ mutate: () => {}, mutateAsync: async () => ({}), isPending: false })
export const useFaceSwap = () => ({ mutate: () => {}, mutateAsync: async () => ({}), isPending: false })
export const getListGeminiConversations = async () => []
export const createGeminiConversation = async () => ({})
export const getGeminiConversation = async () => ({})
export const deleteGeminiConversation = async () => {}
export const listGeminiModels = async () => []
export const generateGeminiImage = async () => ({})
export const generateGeminiVideo = async () => ({})
