import './Skeleton.css';

export function SkeletonBox({
  height = '60px',
  width = '100%',
  borderRadius = '8px',
  marginBottom = '12px',
  style = {},
  className = '',
}) {
  return (
    <div
      className={`skel-box ${className}`}
      style={{
        height,
        width,
        borderRadius,
        marginBottom,
        ...style,
      }}
    />
  );
}

export function ProfileSkeleton() {
  return (
    <div className="skeleton-shimmer" style={{ marginTop: '24px' }}>
      <SkeletonBox height="120px" borderRadius="12px" marginBottom="24px" />
      <SkeletonBox height="60px" borderRadius="8px" marginBottom="12px" />
      <SkeletonBox height="60px" borderRadius="8px" marginBottom="12px" />
    </div>
  );
}

export function GenerationShimmer({ content = 'GENERATING...' }) {
  return (
    <div
      className="loading-shimmer"
      style={{
        aspectRatio: '1 / 1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '48px', height: '48px' }}>
        <img
          src="/assets/logo.png"
          alt="Loading"
          className="loader-pulse-anim"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
      <div
        className="loading-shimmer-text"
        style={{
          position: 'absolute',
          bottom: '16px',
          left: 0,
          right: 0,
          zIndex: 2,
        }}
      >
        {content}
      </div>
    </div>
  );
}
