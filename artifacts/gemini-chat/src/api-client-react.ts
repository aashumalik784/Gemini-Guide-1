// Temporary stubs for all Gemini API hooks - replace with real API later
export const useListGeminiConversations = () => ({ data: [], isLoading: false, error: null })
export const getListGeminiConversationsQueryKey = () => ['conversations']
export const useCreateGeminiConversation = () => ({ mutate: () => {}, mutateAsync: async () => ({}), isPending: false })
export const useGetGeminiConversation = () => ({ data: null, isLoading: false })
export const useDeleteGeminiConversation = () => ({ mutate: () => {}, isPending: false })
export const useListGeminiModels = () => ({ data: [], isLoading: false })
export const useAutoTitleGeminiConversation = () => ({ mutate: () => {} })
export const useUpdateGeminiConversation = () => ({ mutate: () => {}, isPending: false })
export const useSendGeminiMessage = () => ({ mutate: () => {}, isPending: false })
export const useGetGeminiMessages = () => ({ data: [], isLoading: false })
export const getListGeminiConversations = async () => []
export const createGeminiConversation = async () => ({})
export const getGeminiConversation = async () => ({})
export const deleteGeminiConversation = async () => {}
export const listGeminiModels = async () => []
