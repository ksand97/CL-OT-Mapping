import React, { useState, useEffect } from 'react';
import {
  Container,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Box,
  Typography
} from '@mui/material';
import * as XLSX from 'xlsx';

function App() {
  // Raw data states
  const [hoglundData, setHoglundData] = useState(null);
  const [metaData, setMetaData] = useState(null);
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [diffFilter, setDiffFilter] = useState('all');
  // Filtered output
  const [filteredData, setFilteredData] = useState(null);

  // 1) Fetch both JSON files
  useEffect(() => {
    Promise.all([
      fetch('/hoglundData1.json').then(res => res.json()),
      fetch('/metaIngest_from_NT.json').then(res => res.json())
    ])
      .then(([rawH, rawM]) => {
        const hData = Array.isArray(rawH) ? rawH[0] : rawH;
        const mMap = Object.fromEntries(rawM.map(item => [item.tag, item.metadata]));
        setHoglundData(hData);
        setMetaData(mMap);
      })
      .catch(err => console.error('Error loading JSON:', err));
  }, []);

  // 2) Compute tag arrays and merged record
  const hoglundTags = hoglundData ? Object.keys(hoglundData) : [];
  const metaTags = metaData ? Object.keys(metaData) : [];
  const allTags = Array.from(new Set([...hoglundTags, ...metaTags]));

  const onlyInHoglund = allTags.filter(t => hoglundData?.[t] && !metaData?.[t]);
  const onlyInMeta = allTags.filter(t => metaData?.[t] && !hoglundData?.[t]);
  const inBoth = allTags.filter(t => hoglundData?.[t] && metaData?.[t]);

  const masterRecord = Object.fromEntries(
    allTags.map(tag => {
      const rec = hoglundData?.[tag] || {};
      const diffType =
        hoglundData?.[tag] && metaData?.[tag]
          ? 'both'
          : hoglundData?.[tag]
          ? 'onlyHoglund'
          : 'onlyMeta';
      return [tag, { ...rec, metadata: metaData?.[tag] || null, diffType }];
    })
  );

  // 3) Units list includes units from both JSONs
  const units = React.useMemo(() => {
    const u1 = hoglundData
      ? Object.values(hoglundData).map(e => e.UNIT)
      : [];
    const u2 = metaData
      ? Object.values(metaData).map(m => m.unit?.unitSymbol || '')
      : [];
    return Array.from(new Set([...u1, ...u2].filter(u => u)));
  }, [hoglundData, metaData]);

  // 4) Apply filters
  useEffect(() => {
    if (!hoglundData || !metaData) return;
    const lower = searchTerm.toLowerCase();
    const entries = Object.entries(masterRecord).filter(([tag, rec]) => {
      const matchesSearch =
        tag.toLowerCase().includes(lower) ||
        rec.DESCR?.toLowerCase().includes(lower) ||
        rec.metadata?.description?.toLowerCase().includes(lower);
      const matchesUnit = !unitFilter ||
        (rec.UNIT === unitFilter) ||
        (rec.metadata?.unit?.unitSymbol === unitFilter);
      const matchesDiff = diffFilter === 'all' || rec.diffType === diffFilter;
      return matchesSearch && matchesUnit && matchesDiff;
    });
    setFilteredData(Object.fromEntries(entries));
  }, [searchTerm, unitFilter, diffFilter, masterRecord, hoglundData, metaData]);

  // 5) Compute filtered counts for summary
  const filteredEntries = filteredData ? Object.entries(filteredData) : [];
  const filteredHoglundCount = filteredEntries.filter(([, rec]) => rec.diffType === 'both' || rec.diffType === 'onlyHoglund').length;
  const filteredMetaCount = filteredEntries.filter(([, rec]) => rec.diffType === 'both' || rec.diffType === 'onlyMeta').length;
  const filteredBothCount = filteredEntries.filter(([, rec]) => rec.diffType === 'both').length;
  const filteredOnlyHoglundCount = filteredEntries.filter(([, rec]) => rec.diffType === 'onlyHoglund').length;
  const filteredOnlyMetaCount = filteredEntries.filter(([, rec]) => rec.diffType === 'onlyMeta').length;
  const filteredCount = filteredEntries.length;

  // 6) Export
  const exportToExcel = () => {
    if (!filteredData) return;
    const rows = filteredEntries.map(([tag, rec]) => ({
      Tag: tag,
      Description: rec.DESCR || rec.metadata?.name,
      Value: rec.VALUE,
      Status: rec.STATUS,
      Unit: rec.UNIT || rec.metadata?.unit.unitSymbol,
      Created: rec.CREATED?.$date || '',
      Diff: rec.diffType
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comparison');
    XLSX.writeFile(wb, 'comparison.xlsx');
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Høglund Meta Comparison
      </Typography>

      {/* Filters & Export */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          label="Søk"
          variant="outlined"
          sx={{ flex: 1 }}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Enhet</InputLabel>
          <Select
            value={unitFilter}
            onChange={e => setUnitFilter(e.target.value)}
            label="Enhet"
          >
            <MenuItem value="">Alle</MenuItem>
            {units.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 160 }}>
          <InputLabel>Difference</InputLabel>
          <Select
            value={diffFilter}
            onChange={e => setDiffFilter(e.target.value)}
            label="Difference"
          >
            <MenuItem value="all">Alle</MenuItem>
            <MenuItem value="both">I begge</MenuItem>
            <MenuItem value="onlyHoglund">Kun Høglund</MenuItem>
            <MenuItem value="onlyMeta">Kun Meta</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant="contained"
          onClick={exportToExcel}
          disabled={filteredCount === 0}
        >
          Eksporter Excel
        </Button>
      </Box>

      {/* Summary with filtered counts */}
      <Box sx={{ mb: 2 }}>
        <Typography>
          Høglund total: {filteredHoglundCount} | Meta total: {filteredMetaCount} | I begge: {filteredBothCount} | Kun Høglund: {filteredOnlyHoglundCount} | Kun Meta: {filteredOnlyMetaCount}
        </Typography>
      </Box>

      {/* Data Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Tag</TableCell>
              <TableCell>Beskrivelse</TableCell>
              <TableCell>Verdi</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Enhet</TableCell>
              <TableCell>Opprettet</TableCell>
              <TableCell>Diff</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEntries.map(([tag, rec]) => (
              <TableRow key={tag}>
                <TableCell>{tag}</TableCell>
                <TableCell>{rec.DESCR || rec.metadata?.name}</TableCell>
                <TableCell>{rec.VALUE}</TableCell>
                <TableCell>{rec.STATUS}</TableCell>
                <TableCell>{rec.UNIT || rec.metadata?.unit.unitSymbol}</TableCell>
                <TableCell>{rec.CREATED?.$date ? new Date(rec.CREATED.$date).toLocaleString() : ''}</TableCell>
                <TableCell>{rec.diffType}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}

export default App;
