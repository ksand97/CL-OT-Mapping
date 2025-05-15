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
  const [swaggerData, setSwaggerData] = useState(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [diffFilter, setDiffFilter] = useState('all');
  const [filteredData, setFilteredData] = useState(null);

  // Fetch JSON files
  useEffect(() => {
    Promise.all([
      fetch('/hoglundData1.json').then(r => r.json()),
      fetch('/metaIngest_from_NT.json').then(r => r.json()),
      fetch('/swagger_from_UDS.json').then(r => r.json())
    ])
      .then(([rawH, rawM, rawS]) => {
        const hData = Array.isArray(rawH) ? rawH[0] : rawH;
        setHoglundData(hData);
        const mMap = Object.fromEntries(rawM.map(item => [item.tag, item.metadata]));
        setMetaData(mMap);
        setSwaggerData(rawS);
      })
      .catch(err => console.error('Error loading data', err));
  }, []);

  // Build lookup map from swaggerData
  const swaggerMap = swaggerData
    ? Object.fromEntries(swaggerData.map(item => [item.sourceTag, item]))
    : {};

  // Tag lists
  const hoglundTags = hoglundData ? Object.keys(hoglundData) : [];
  const metaTags = metaData ? Object.keys(metaData) : [];
  const swaggerTags = swaggerData ? swaggerData.map(s => s.sourceTag) : [];
  const allTags = Array.from(new Set([...hoglundTags, ...metaTags, ...swaggerTags]));

  // Difference sets
  const inBoth = allTags.filter(t => hoglundData?.[t] && metaData?.[t]);
  const onlyInHoglund = allTags.filter(t => hoglundData?.[t] && !metaData?.[t]);
  const onlyInMeta = allTags.filter(t => metaData?.[t] && !hoglundData?.[t]);

  // Master record merging Høglund, metadata, swagger
  const masterRecord = Object.fromEntries(
    allTags.map(tag => {
      const rec = hoglundData?.[tag] || {};
      const meta = metaData?.[tag] || {};
      const sw = swaggerMap[tag] || null;
      return [tag, { ...rec, metadata: meta, swagger: sw }];
    })
  );

  // Units list from all sources
  const units = React.useMemo(() => {
    const u1 = hoglundData ? Object.values(hoglundData).map(e => e.UNIT) : [];
    const u2 = metaData ? Object.values(metaData).map(m => m.unit?.unitSymbol) : [];
    const u3 = swaggerData ? swaggerData.map(s => s.metaUnit) : [];
    return Array.from(new Set([...u1, ...u2, ...u3].filter(u => u)));
  }, [hoglundData, metaData, swaggerData]);

  // Apply filters
  useEffect(() => {
    if (!hoglundData || !metaData || !swaggerData) return;
    const lower = searchTerm.toLowerCase();
    const entries = Object.entries(masterRecord).filter(([tag, rec]) => {
      const matchesSearch =
        tag.toLowerCase().includes(lower) ||
        rec.DESCR?.toLowerCase().includes(lower) ||
        rec.metadata?.description?.toLowerCase().includes(lower) ||
        rec.swagger?.metaDescription?.toLowerCase().includes(lower);
      const matchesUnit =
        !unitFilter ||
        rec.UNIT === unitFilter ||
        rec.metadata?.unit?.unitSymbol === unitFilter ||
        rec.swagger?.metaUnit === unitFilter;
      const matchesDiff =
        diffFilter === 'all' ||
        (diffFilter === 'both' && inBoth.includes(tag)) ||
        (diffFilter === 'onlyHoglund' && onlyInHoglund.includes(tag)) ||
        (diffFilter === 'onlyMeta' && onlyInMeta.includes(tag));
      return matchesSearch && matchesUnit && matchesDiff;
    });
    setFilteredData(Object.fromEntries(entries));
  }, [searchTerm, unitFilter, diffFilter, masterRecord, hoglundData, metaData, swaggerData]);

  // Counts for summary
  const filteredEntries = filteredData ? Object.entries(filteredData) : [];
  const filteredHCount = filteredEntries.filter(([, rec]) => !!rec.DESCR).length;
  const filteredMCount = filteredEntries.filter(([, rec]) => !!rec.metadata).length;
  const filteredSCount = filteredEntries.filter(([, rec]) => !!rec.swagger).length;

  // Export to Excel
  const exportToExcel = () => {
    if (!filteredData) return;
    const rows = filteredEntries.map(([tag, rec]) => ({
      Tag: tag,
      Description: rec.DESCR || rec.metadata?.name || rec.swagger?.metaDescription,
      Value: rec.VALUE || rec.swagger?.lastValue,
      Status: rec.STATUS,
      Unit: rec.UNIT || rec.metadata?.unit?.unitSymbol || rec.swagger?.metaUnit,
      Created: rec.CREATED?.$date
        ? new Date(rec.CREATED.$date).toLocaleString()
        : rec.swagger?.lastTimeStamp
        ? new Date(rec.swagger.lastTimeStamp).toLocaleString()
        : '',
      Path: rec.swagger?.topics?.map(t => t.path).join(', ')
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AllComparison');
    XLSX.writeFile(wb, 'all_comparison.xlsx');
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Multi-Source Comparison
      </Typography>

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
          disabled={filteredEntries.length === 0}
        >
          Eksporter alle
        </Button>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography>
          Høglund total: {filteredHCount} | Meta total: {filteredMCount} | Swagger total: {filteredSCount}
        </Typography>
      </Box>

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
              <TableCell>Path</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEntries.map(([tag, rec]) => (
              <TableRow key={tag}>
                <TableCell>{tag}</TableCell>
                <TableCell>{rec.DESCR || rec.metadata?.name || rec.swagger?.metaDescription}</TableCell>
                <TableCell>{rec.VALUE || rec.swagger?.lastValue}</TableCell>
                <TableCell>{rec.STATUS}</TableCell>
                <TableCell>{rec.UNIT || rec.metadata?.unit?.unitSymbol || rec.swagger?.metaUnit}</TableCell>
                <TableCell>{rec.CREATED?.$date ? new Date(rec.CREATED.$date).toLocaleString() : rec.swagger?.lastTimeStamp ? new Date(rec.swagger.lastTimeStamp).toLocaleString() : ''}</TableCell>
                <TableCell>{rec.swagger?.topics?.map(t => t.path).join(', ')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}

export default App;
