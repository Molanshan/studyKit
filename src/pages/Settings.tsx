import { ArrowLeft, Check, Info } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { COLORS, THEME_COLORS } from '../lib/constants'
import { useAppStore } from '../lib/store'
import { SettingRow } from '../components/ui'

function Toggle({ on, onChange }: { on: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      className="toggle"
      data-on={on}
      aria-pressed={on}
      onClick={() => onChange(!on)}
      aria-label={on ? '关闭' : '开启'}
    />
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)

  return (
    <div className="page">
      <header className="page-head">
        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)} aria-label="返回">
            <ArrowLeft size={19} />
          </button>
          <div>
            <p className="eyebrow">设置</p>
            <h1 style={{ fontSize: 22 }}>按自己的习惯刷题</h1>
          </div>
        </div>
      </header>

      <div className="card">
        <div className="card-head">
          <h3>主题色</h3>
          <span className="tiny">{COLORS[settings.accent]?.name}</span>
        </div>
        <div className="swatches">
          {THEME_COLORS.map((key) => (
            <button
              key={key}
              className="swatch"
              data-active={settings.accent === key}
              style={{ background: COLORS[key].solid }}
              onClick={() => updateSettings({ accent: key })}
              aria-label={COLORS[key].name}
            />
          ))}
        </div>
        <div className="divider" style={{ margin: '16px 0' }} />
        <SettingRow label="深色模式" description="夜间刷题更省眼">
          <Toggle on={settings.dark} onChange={(dark) => updateSettings({ dark })} />
        </SettingRow>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>刷题</h3>
        </div>
        <SettingRow label="答对自动下一题" description="客观题答对后约 0.75 秒自动跳转">
          <Toggle on={settings.autoNext} onChange={(autoNext) => updateSettings({ autoNext })} />
        </SettingRow>
        <SettingRow label="默认题量" description="从首页或题库开始练习时的默认数量">
          <div className="row" style={{ gap: 6 }}>
            {[10, 20, 30, 50].map((value) => (
              <button
                key={value}
                className="chip"
                data-active={settings.defaultCount === value}
                onClick={() => updateSettings({ defaultCount: value })}
              >
                {value}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow label="题干字号" description={`${settings.fontSize}px`}>
          <input
            className="range"
            type="range"
            min={14}
            max={20}
            step={1}
            value={settings.fontSize}
            onChange={(event) => updateSettings({ fontSize: Number(event.target.value) })}
            style={{ width: 140 }}
          />
        </SettingRow>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>判分</h3>
        </div>
        <SettingRow
          label="填空题逐空给分"
          description="关闭后，填空题需要全部空位答对才得分"
        >
          <Toggle
            on={settings.partialFill}
            onChange={(partialFill) => updateSettings({ partialFill })}
          />
        </SettingRow>
        <SettingRow
          label="填空区分大小写"
          description="关闭时「Apple」与「apple」都算对"
        >
          <Toggle
            on={settings.caseSensitive}
            onChange={(caseSensitive) => updateSettings({ caseSensitive })}
          />
        </SettingRow>
        <div className="alert" style={{ marginTop: 12 }}>
          <Info size={16} />
          <span>选择题与判断题始终按答案严格判分，不受以上设置影响。</span>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>题目格式建议</h3>
          <span className="badge">提高识别率</span>
        </div>
        <div className="stack" style={{ gap: 10 }}>
          {[
            '用「一、单项选择题」这类分区标题，题型识别最准',
            '题号统一用 1. 2. 3. 或 1、2、3、，不要混用',
            '选项单独成行或用 A. B. C. D. 连写都可以',
            '答案用「答案：B」或「参考答案：」，解析用「解析：」',
            '填空题用 ______ 表示空位，多个空就写多组下划线',
            '判断题答案可以写「对/错」「√/×」「正确/错误」',
          ].map((text) => (
            <div key={text} className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
              <Check size={15} color="var(--success)" style={{ marginTop: 3, flex: '0 0 15px' }} />
              <span className="muted" style={{ fontSize: 13.5 }}>
                {text}
              </span>
            </div>
          ))}
        </div>
        <div className="divider" style={{ margin: '14px 0' }} />
        <button className="btn btn-soft btn-block" onClick={() => navigate('/debug/parser')}>
          打开解析器调试
        </button>
      </div>
    </div>
  )
}
