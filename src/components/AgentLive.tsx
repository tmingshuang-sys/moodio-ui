// ===== 执行期间的显式化：工作区表面盖一层淡蓝紫流光，顶部一个状态胶囊（带停止）=====
import { useAgent, useFiles } from '../lib/store';
import { stopAgent } from '../lib/agent/runner';

export default function AgentLive() {
  const glow = useAgent(s => s.glow); const live = useAgent(s => s.live); const busy = useAgent(s => s.busy);
  const paneOpen = useFiles(s => s.ui.paneOpen);
  return (
    <>
      <div className={`agent-glow${glow && paneOpen ? ' on' : ''}`} aria-hidden="true" />
      {busy && live && (
        <div className="agent-live" role="status">
          <span className="agent-live-dot" /><span className="agent-live-text">{live}</span>
          <button type="button" onClick={stopAgent}>停止</button>
        </div>
      )}
    </>
  );
}
