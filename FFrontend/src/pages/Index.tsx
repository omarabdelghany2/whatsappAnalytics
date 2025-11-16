import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GroupList } from "@/components/GroupList";
import { ChatView } from "@/components/ChatView";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";
import { api, wsClient, Message, Event } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [translateMode, setTranslateMode] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch groups
  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: api.getGroups,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch all messages
  const { data: messagesData, isLoading: messagesLoading, refetch: refetchMessages } = useQuery({
    queryKey: ['messages'],
    queryFn: () => api.getMessages(100, 0),
    enabled: !!groupsData?.groups?.length,
  });

  // Fetch statistics
  const { data: statsData } = useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
    refetchInterval: 60000, // Refetch every minute
    enabled: !!groupsData?.groups?.length,
  });

  // Set initial selected group
  useEffect(() => {
    if (groupsData?.groups && groupsData.groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groupsData.groups[0].id);
    }
  }, [groupsData, selectedGroupId]);

  // Set messages when data changes
  useEffect(() => {
    if (messagesData?.messages) {
      setMessages(messagesData.messages);
    }
  }, [messagesData]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    wsClient.connect();

    wsClient.onMessage((newMessage) => {
      console.log('📨 New message received:', newMessage);

      // Add new message to the list
      setMessages((prev) => [newMessage, ...prev]);

      // Show toast notification
      toast({
        title: `New message in ${newMessage.groupName}`,
        description: `${newMessage.sender}: ${newMessage.message.substring(0, 50)}...`,
      });

      // Refetch messages to ensure consistency
      refetchMessages();
    });

    wsClient.onEvent((event) => {
      console.log('👥 Event received:', event);

      setEvents((prev) => [event, ...prev]);

      // Show toast notification
      const action = event.type === 'JOIN' ? 'joined' : 'left';
      toast({
        title: `${event.memberName} ${action}`,
        description: `Group: ${event.groupName}`,
      });
    });

    wsClient.onGroupAdded((group) => {
      console.log('➕ Group added:', group);

      // Invalidate and refetch groups
      queryClient.invalidateQueries({ queryKey: ['groups'] });

      toast({
        title: "New group added",
        description: `Now monitoring "${group.name}"`,
      });
    });

    wsClient.onConnect(() => {
      toast({
        title: "Connected",
        description: "Real-time updates enabled",
      });
    });

    wsClient.onDisconnect(() => {
      toast({
        title: "Disconnected",
        description: "WhatsApp connection lost",
        variant: "destructive",
      });
    });

    return () => {
      wsClient.disconnect();
    };
  }, [toast, refetchMessages, queryClient]);

  const handleTranslate = () => {
    setTranslateMode(!translateMode);
  };

  const handleAddGroup = async (name: string) => {
    try {
      const result = await api.addGroup(name);

      toast({
        title: "Group added successfully",
        description: `Now monitoring "${result.group.name}"`,
      });

      // Refetch groups and messages to update the list
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      refetchMessages();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add group';
      toast({
        title: "Failed to add group",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Transform backend data to frontend format
  const transformedGroups = groupsData?.groups?.map((group) => {
    const groupMessages = messages.filter((msg) => msg.groupId === group.id);
    const lastMessage = groupMessages.length > 0 ? groupMessages[0] : null;

    const unreadCount = groupMessages.filter((msg) => {
      const msgTime = new Date(msg.timestamp);
      const now = new Date();
      const diffMinutes = (now.getTime() - msgTime.getTime()) / 1000 / 60;
      return diffMinutes < 5; // Consider messages from last 5 minutes as "unread"
    }).length;

    return {
      id: group.id,
      name: group.name,
      lastMessage: lastMessage?.message || "No messages yet",
      timestamp: lastMessage ? new Date(lastMessage.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }) : "",
      unread: unreadCount,
      members: group.memberCount,
    };
  }) || [];

  // Get messages for selected group
  const selectedGroupMessages = selectedGroupId
    ? messages.filter((msg) => msg.groupId === selectedGroupId)
    : messages;

  // Sort messages oldest first (ascending by timestamp)
  const sortedMessages = [...selectedGroupMessages].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Transform messages to frontend format
  const transformedMessages = sortedMessages.map((msg) => ({
    id: msg.id,
    sender: msg.sender,
    content: msg.message,
    timestamp: new Date(msg.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    }),
    isOwn: false, // We don't track which messages are from the current user
  }));

  // Get selected group name
  const selectedGroupName = selectedGroupId
    ? transformedGroups.find((g) => g.id === selectedGroupId)?.name || ""
    : "All Groups";

  // Calculate analytics
  const selectedGroupStats = statsData?.stats?.groups?.find(
    (g) => g.id === selectedGroupId
  );

  const analytics = {
    totalMembers: selectedGroupStats?.memberCount || 0,
    joined: events.filter((e) => e.type === 'JOIN' && (!selectedGroupId || e.groupId === selectedGroupId)).length,
    left: events.filter((e) => e.type === 'LEAVE' && (!selectedGroupId || e.groupId === selectedGroupId)).length,
    messageCount: selectedGroupStats?.messageCount || selectedGroupMessages.length,
    activeUsers: selectedGroupStats?.topSenders?.length || 0,
  };

  if (groupsLoading || messagesLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Loading...</div>
          <div className="text-sm text-muted-foreground">Connecting to WhatsApp Analytics</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">
          {translateMode ? "WhatsApp 分析" : "WhatsApp Analytics"}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTranslate}
            className="gap-2"
          >
            <Languages className="h-4 w-4" />
            {translateMode ? "显示原文" : "Translate to Chinese"}
          </Button>
          <ThemeToggle />
        </div>
      </header>
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        <div className="col-span-3">
          <GroupList
            groups={transformedGroups}
            selectedGroupId={selectedGroupId || ""}
            onSelectGroup={setSelectedGroupId}
            onAddGroup={handleAddGroup}
            translateMode={translateMode}
          />
        </div>
        <div className="col-span-6">
          <ChatView
            messages={transformedMessages}
            groupName={selectedGroupName}
          />
        </div>
        <div className="col-span-3">
          <AnalyticsPanel analytics={analytics} translateMode={translateMode} />
        </div>
      </div>
    </div>
  );
};

export default Index;
