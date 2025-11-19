import { NewAgent } from '../install-agent/new-agent.js';
import { ProjectContext } from '../repodetect/index.js';

describe('NewAgent tool validation', () => {
  let agent: NewAgent;
  const mockProjectContext: ProjectContext = {
    name: 'test-project',
    targets: {}
  };

  beforeEach(() => {
    agent = new NewAgent({
      serverUrl: 'http://test.com',
      apiKey: 'test-key',
      cwd: '/tmp',
      projectContext: mockProjectContext
    });
  });

  describe('executeTool validation', () => {
    it('should validate read_file arguments correctly', async () => {
      const validArgs = { path: 'test.txt', tool_call_id: 'call_123' };

      // Mock the readFile method to avoid actual file operations
      const readFileSpy = jest.spyOn(agent as any, 'readFile').mockResolvedValue({ success: true });

      await (agent as any).executeTool('read_file', validArgs);

      expect(readFileSpy).toHaveBeenCalledWith('test.txt');
    });

    it('should reject read_file with missing path', async () => {
      const invalidArgs = { tool_call_id: 'call_123' };

      await expect((agent as any).executeTool('read_file', invalidArgs))
        .rejects.toThrow('Invalid arguments for tool read_file');
    });

    it('should reject read_file with invalid path type', async () => {
      const invalidArgs = { path: 123, tool_call_id: 'call_123' };

      await expect((agent as any).executeTool('read_file', invalidArgs))
        .rejects.toThrow('Invalid arguments for tool read_file');
    });

    it('should validate write_file arguments correctly', async () => {
      const validArgs = { path: 'test.txt', content: 'Hello World', tool_call_id: 'call_123' };

      const writeFileSpy = jest.spyOn(agent as any, 'writeFile').mockResolvedValue({ success: true });

      await (agent as any).executeTool('write_file', validArgs);

      expect(writeFileSpy).toHaveBeenCalledWith('test.txt', 'Hello World');
    });

    it('should reject write_file with missing content', async () => {
      const invalidArgs = { path: 'test.txt', tool_call_id: 'call_123' };

      await expect((agent as any).executeTool('write_file', invalidArgs))
        .rejects.toThrow('Invalid arguments for tool write_file');
    });

    it('should validate list_directory with optional include_hidden', async () => {
      const validArgs = { path: '.', include_hidden: true, tool_call_id: 'call_123' };

      const listDirSpy = jest.spyOn(agent as any, 'listDirectory').mockResolvedValue({ success: true });

      await (agent as any).executeTool('list_directory', validArgs);

      expect(listDirSpy).toHaveBeenCalledWith('.', true);
    });

    it('should validate list_directory without optional include_hidden', async () => {
      const validArgs = { path: '.', tool_call_id: 'call_123' };

      const listDirSpy = jest.spyOn(agent as any, 'listDirectory').mockResolvedValue({ success: true });

      await (agent as any).executeTool('list_directory', validArgs);

      expect(listDirSpy).toHaveBeenCalledWith('.', undefined);
    });

    it('should reject unknown tool', async () => {
      const args = { some: 'arg', tool_call_id: 'call_123' };

      await expect((agent as any).executeTool('unknown_tool', args))
        .rejects.toThrow('Unknown tool: unknown_tool');
    });

    it('should validate get_bulk_target_data with string targetNames', async () => {
      const validArgs = { targetNames: 'target1', tool_call_id: 'call_123' };

      const bulkDataSpy = jest.spyOn(agent as any, 'getBulkTargetData').mockResolvedValue({ success: true });

      await (agent as any).executeTool('get_bulk_target_data', validArgs);

      expect(bulkDataSpy).toHaveBeenCalledWith('target1', undefined);
    });

    it('should validate get_bulk_target_data with array targetNames', async () => {
      const validArgs = { targetNames: ['target1', 'target2'], repoPath: '/repo', tool_call_id: 'call_123' };

      const bulkDataSpy = jest.spyOn(agent as any, 'getBulkTargetData').mockResolvedValue({ success: true });

      await (agent as any).executeTool('get_bulk_target_data', validArgs);

      expect(bulkDataSpy).toHaveBeenCalledWith(['target1', 'target2'], '/repo');
    });
  });

  describe('runConversation iterative behavior', () => {
    it('should handle iterative conversation without recursion', async () => {
      // Mock fetch to simulate conversation flow
      const mockFetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            action: 'tool_call',
            tool_name: 'read_file',
            data: { path: 'test.txt', tool_call_id: 'call_123' }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            action: 'response',
            message: 'File content processed'
          })
        });

      global.fetch = mockFetch;

      // Mock the tool execution
      jest.spyOn(agent as any, 'readFile').mockResolvedValue({ success: true, content: 'test content' });

      const result = await (agent as any).runConversation('test-agent-id');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        text: 'File content processed',
        toolCalls: [],
        toolResults: [],
        finishReason: 'stop',
        usage: {}
      });
    });

    it('should prevent infinite loops with max iterations', async () => {
      // Mock fetch to always return tool_call (infinite loop scenario)
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          action: 'tool_call',
          tool_name: 'read_file',
          data: { path: 'test.txt', tool_call_id: 'call_123' }
        })
      });

      global.fetch = mockFetch;
      jest.spyOn(agent as any, 'readFile').mockResolvedValue({ success: true });

      await expect((agent as any).runConversation('test-agent-id'))
        .rejects.toThrow('Conversation exceeded maximum iterations (50).');

      expect(mockFetch).toHaveBeenCalledTimes(50);
    });
  });
});
