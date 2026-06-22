import os
import glob

# Files to skip (must keep SimpMessagingTemplate)
skip_files = ['RedisStompSubscriber.java', 'WebSocketConfig.java']

def process_file(filepath):
    filename = os.path.basename(filepath)
    if filename in skip_files:
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if 'SimpMessagingTemplate' not in content and 'messagingTemplate.convertAndSend' not in content:
        return
        
    print(f"Refactoring {filepath}...")
    
    # 1. Replace import
    content = content.replace('import org.springframework.messaging.simp.SimpMessagingTemplate;', 'import com.ripplechat.backend.redis.RedisBroadcastService;')
    
    # 2. Replace field declaration
    content = content.replace('SimpMessagingTemplate messagingTemplate;', 'RedisBroadcastService redisBroadcastService;')
    
    # 3. Replace constructor parameters (explicit)
    content = content.replace('SimpMessagingTemplate messagingTemplate', 'RedisBroadcastService redisBroadcastService')
    
    # 4. Replace field assignment
    content = content.replace('this.messagingTemplate = messagingTemplate;', 'this.redisBroadcastService = redisBroadcastService;')
    
    # 5. Replace method calls
    content = content.replace('messagingTemplate.convertAndSend', 'redisBroadcastService.broadcast')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

backend_dir = r"d:\ripplechat\backend\src\main\java\com\ripplechat\backend"
for root, dirs, files in os.walk(backend_dir):
    for file in files:
        if file.endswith('.java'):
            process_file(os.path.join(root, file))

print("Refactoring complete.")
