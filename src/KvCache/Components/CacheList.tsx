import CacheListHeader from './CacheListHeader';
import CacheListToolbar from './CacheListToolbar';
import CacheCells from './CacheCells';
import CacheListFooter from './CacheListFooter';
import styles from './CacheList.module.css';

// The left column: a fixed stats/refresh header, a cell display toolbar,
// the scrollable cache grid, and a footer with the related-cells search.
function CacheList() {
  return (
    <div className={styles.list}>
      <CacheListHeader />
      <CacheListToolbar />
      <div className={styles.content}>
        <CacheCells />
      </div>
      <CacheListFooter />
    </div>
  );
}

export default CacheList;
