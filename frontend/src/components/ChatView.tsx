import { useState, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  isOwn: boolean;
}

interface ChatViewProps {
  messages: Message[];
  groupName: string;
}

export function ChatView({ messages, groupName }: ChatViewProps) {
  const [translatedMessages, setTranslatedMessages] = useState<Map<string, string>>(new Map());
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Check if user is at bottom
  const checkIfAtBottom = () => {
    if (scrollViewportRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollViewportRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 100; // 100px threshold
      setIsAtBottom(atBottom);
    }
  };

  // Auto-scroll to bottom only if user was already at bottom
  useEffect(() => {
    if (scrollViewportRef.current && isAtBottom) {
      scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  }, [messages, isAtBottom]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  }, []);

  // Get visible messages (only those currently in viewport)
  const getVisibleMessages = () => {
    if (!scrollViewportRef.current) return [];

    const viewport = scrollViewportRef.current;
    const messageElements = viewport.querySelectorAll('[data-message-id]');
    const visibleMessages: Message[] = [];

    messageElements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();

      // Check if element is visible in viewport
      if (rect.top >= viewportRect.top && rect.bottom <= viewportRect.bottom) {
        const messageId = element.getAttribute('data-message-id');
        const message = messages.find(m => m.id === messageId);
        if (message) {
          visibleMessages.push(message);
        }
      }
    });

    return visibleMessages.slice(0, 10); // Limit to 10 messages
  };

  const handleTranslateMessage = (messageId: string) => {
    setTranslatedMessages(prev => {
      const newMap = new Map(prev);
      if (newMap.has(messageId)) {
        newMap.delete(messageId);
      } else {
        newMap.set(messageId, ''); // Placeholder while translating
        // TODO: Call backend API to translate this single message
      }
      return newMap;
    });
  };

  const handleTranslateAll = async () => {
    setIsTranslatingAll(true);

    try {
      // If already translated, clear translations
      if (translatedMessages.size > 0) {
        setTranslatedMessages(new Map());
        setIsTranslatingAll(false);
        return;
      }

      // Get only visible messages (max 10)
      const visibleMessages = getVisibleMessages();

      if (visibleMessages.length === 0) {
        setIsTranslatingAll(false);
        return;
      }

      // Call backend translation API
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: visibleMessages.map(msg => ({
            id: msg.id,
            content: msg.content
          }))
        })
      });

      const data = await response.json();

      if (data.success && data.translations) {
        const newTranslations = new Map<string, string>();
        data.translations.forEach((t: any) => {
          if (t.success) {
            newTranslations.set(t.id, t.translated);
          }
        });
        setTranslatedMessages(newTranslations);
      }
    } catch (error) {
      console.error('Translation error:', error);
    }

    setIsTranslatingAll(false);
  };

  return (
    <div className="h-full flex flex-col bg-chat-bg">
      <div className="p-4 border-b border-border bg-card flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{groupName}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTranslateAll}
          disabled={isTranslatingAll || messages.length === 0}
          className="gap-2"
        >
          <Languages className="h-4 w-4" />
          {isTranslatingAll
            ? "Translating..."
            : translatedMessages.size > 0
            ? "Show Original"
            : "Translate to Chinese"}
        </Button>
      </div>
      <div className="flex-1 overflow-hidden" style={{ flex: '1 1 0', minHeight: 0 }}>
        <div
          ref={scrollViewportRef}
          onScroll={checkIfAtBottom}
          className="h-full overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200"
        >
          <div className="space-y-4">
            {messages.map((message) => {
              const translation = translatedMessages.get(message.id);
              return (
                <div
                  key={message.id}
                  data-message-id={message.id}
                  className="flex gap-2 items-start justify-start"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 hover:opacity-100 transition-opacity"
                    onClick={() => handleTranslateMessage(message.id)}
                  >
                    <Languages className="h-4 w-4" />
                  </Button>
                  <div className="max-w-[70%] rounded-lg p-3 shadow-sm bg-chat-received text-chat-received-foreground">
                    <p className="text-xs font-semibold mb-1 opacity-70">{message.sender}</p>
                    <p className="text-sm break-words">
                      {message.content}
                      {translation && (
                        <span className="block mt-2 pt-2 border-t border-current/20 italic opacity-90">
                          🇨🇳 {translation}
                        </span>
                      )}
                    </p>
                    <p className="text-xs mt-1 opacity-60">{message.timestamp}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
