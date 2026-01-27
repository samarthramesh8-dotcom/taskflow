type ProfileProps = {
  name: string
  major: string
}

function Profile({ name, major }: ProfileProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 14 }}>{name}</div>
        <div style={{ opacity: 0.7, marginTop: 4, fontSize: 12 }}>{major}</div>
      </div>
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 14,
          display: "grid",
          placeItems: "center",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          fontWeight: 900,
        }}
        aria-hidden
      >
        {name.slice(0, 1).toUpperCase()}
      </div>
    </div>
  )
}

export default Profile

