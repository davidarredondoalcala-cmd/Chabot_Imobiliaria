import { Body, Controller, Get, Param, Post, BadRequestException } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { ChatbotService } from './chatbot.service';

@Controller()
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Public()
  @Post(['api/chat', 'chatbot/chat'])
  async chat(@Body() body: { conversationId?: string; message?: string }) {
    const message = body?.message?.trim();
    if (!message) {
      throw new BadRequestException('El mensaje no puede estar vacío');
    }
    const conversationId = body?.conversationId || `conv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    return await this.chatbotService.processMessage(conversationId, message);
  }

  @Public()
  @Get(['api/conversations/:id', 'chatbot/conversations/:id'])
  async getConversation(@Param('id') id: string) {
    const messages = await this.chatbotService.getMessages(id);
    return {
      conversationId: id,
      messages,
    };
  }

  @Public()
  @Get(['api/health', 'chatbot/health'])
  getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Habitat Capital Chatbot Agent',
      version: '1.0.0',
    };
  }
}
