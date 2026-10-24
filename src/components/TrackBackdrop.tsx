import './TrackBackdrop.css'

interface TrackBackdropProps {
  faded?: boolean
  withCar?: boolean
}

export function TrackBackdrop({ faded = false, withCar = false }: TrackBackdropProps) {
  return (
    <svg
      className={`track${faded ? ' track--faded' : ''}`}
      viewBox="170 160 1200 690"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      shapeRendering="crispEdges"
    >
      <rect
        className="track__asphalt"
        x="262"
        y="254"
        width="1016"
        height="504"
        rx="252"
        ry="252"
      />
      <rect
        className="track__kerb track__kerb--outer"
        x="234"
        y="226"
        width="1072"
        height="560"
        rx="280"
        ry="280"
      />
      <rect
        className="track__kerb track__kerb--inner"
        x="290"
        y="282"
        width="960"
        height="448"
        rx="224"
        ry="224"
      />
      <rect
        className="track__dashes"
        x="262"
        y="254"
        width="1016"
        height="504"
        rx="252"
        ry="252"
      />

      {withCar && (
        <>
          <g className="track__start">
            {Array.from({ length: 6 }, (_, row) => (
              <rect key={row} x={680 + (row % 2) * 8} y={734 + row * 8} width="8" height="8" />
            ))}
          </g>
          <g className="track__flag">
            <rect x="1232" y="278" width="9" height="9" />
            <rect x="1250" y="278" width="9" height="9" />
            <rect x="1241" y="287" width="9" height="9" />
            <rect x="1232" y="296" width="9" height="9" />
            <rect x="1250" y="296" width="9" height="9" />
          </g>
          <g className="track__car">
            <rect x="420" y="752" width="42" height="12" />
            <rect x="428" y="746" width="22" height="6" />
          </g>
        </>
      )}
    </svg>
  )
}
