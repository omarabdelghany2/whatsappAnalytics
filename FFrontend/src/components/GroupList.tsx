import { useState } from "react";
import { Users, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Group {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  members: number;
}

interface GroupListProps {
  groups: Group[];
  selectedGroupId: string;
  onSelectGroup: (groupId: string) => void;
  onAddGroup: (name: string) => void;
  translateMode: boolean;
}

export function GroupList({ groups, selectedGroupId, onSelectGroup, onAddGroup, translateMode }: GroupListProps) {
  const [newGroupName, setNewGroupName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newGroupName.trim()) {
      onAddGroup(newGroupName.trim());
      setNewGroupName("");
    }
  };

  return (
    <div className="h-full border-r border-border bg-card flex flex-col">
      <div className="p-4 border-b border-border space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          {translateMode ? "群组聊天" : "Group Chats"}
        </h2>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="text"
            placeholder={translateMode ? "群组名称" : "Group name"}
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </div>
      <div className="flex-1 overflow-y-auto">
        {groups.map((group) => (
          <button
            key={group.id}
            onClick={() => onSelectGroup(group.id)}
            className={cn(
              "w-full p-4 text-left border-b border-border transition-colors hover:bg-muted",
              selectedGroupId === group.id && "bg-primary/10 border-l-4 border-l-primary"
            )}
          >
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-semibold text-foreground truncate">{group.name}</h3>
              <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                {group.timestamp}
              </span>
            </div>
            <p className="text-sm text-muted-foreground truncate mb-2">{group.lastMessage}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center text-xs text-muted-foreground">
                <Users className="h-3 w-3 mr-1" />
                {group.members}
              </div>
              {group.unread > 0 && (
                <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5 font-medium">
                  {group.unread}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
